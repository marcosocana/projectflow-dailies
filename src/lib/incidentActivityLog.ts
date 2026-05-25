import { supabase } from '@/integrations/supabase/client';
import { getStatusLogValue } from '@/lib/taskStatus';

type IncidentStatusLogInput = {
  projectId: string;
  incidentId: string;
  incidentNumber: number;
  incidentName: string;
  incidentCategory: string;
  fromStatus: string;
  toStatus: string;
  fromEnvironment?: string | null;
  toEnvironment?: string | null;
};

type ActivityActor = {
  userId: string | null;
  name: string;
  color: string;
};

async function loadActivityActor(): Promise<ActivityActor | null> {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, color')
    .eq('user_id', authUser.id)
    .maybeSingle();

  const email = authUser.email || '';
  const trimmedName = profile?.full_name?.trim() || '';
  const actorName = trimmedName
    ? `${trimmedName} (${email})`
    : (email || 'Usuario');

  return {
    userId: authUser.id,
    name: actorName,
    color: profile?.color || '#3B82F6',
  };
}

async function recordIncidentActivity(input: IncidentStatusLogInput) {
  try {
    const actor = await loadActivityActor();
    if (!actor) return;

    const { error } = await supabase.from('incident_activity_logs').insert({
      project_id: input.projectId,
      incident_id: input.incidentId,
      incident_number: input.incidentNumber,
      incident_name: input.incidentName,
      incident_category: input.incidentCategory,
      from_status: getStatusLogValue(input.fromStatus, input.fromEnvironment),
      to_status: getStatusLogValue(input.toStatus, input.toEnvironment),
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_color: actor.color,
      event_type: 'incident_activity',
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording incident activity log:', error);
  }
}

export async function recordIncidentStatusChange(input: IncidentStatusLogInput) {
  await recordIncidentActivity(input);
}

export async function recordIncidentCreated(input: Omit<IncidentStatusLogInput, 'fromStatus'>) {
  await recordIncidentActivity({
    ...input,
    fromStatus: 'created',
  });
}

export async function recordIncidentDeleted(input: Omit<IncidentStatusLogInput, 'fromStatus' | 'toStatus'>) {
  try {
    const actor = await loadActivityActor();
    if (!actor) return;

    const { error } = await supabase.from('incident_activity_logs').insert({
      project_id: input.projectId,
      incident_id: input.incidentId,
      incident_number: input.incidentNumber,
      incident_name: input.incidentName,
      incident_category: input.incidentCategory,
      from_status: 'deleted',
      to_status: 'deleted',
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_color: actor.color,
      event_type: 'incident_deleted',
      message: `${actor.name} eliminó ${input.incidentNumber} - ${input.incidentName}.`,
      metadata: {
        incidentId: input.incidentId,
        incidentNumber: input.incidentNumber,
        incidentName: input.incidentName,
        incidentCategory: input.incidentCategory,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording incident deletion log:', error);
  }
}

export async function recordDailyTaskCreated(input: {
  projectId: string;
  taskId: string;
  title: string;
  relatedTicket: string | null;
  taskCount?: number;
}) {
  try {
    const actor = await loadActivityActor();
    if (!actor) return;

    const message = `${actor.name} creó una tarea nueva: ${input.relatedTicket ? `${input.relatedTicket} - ` : ''}${input.title}.`;
    const { error } = await supabase.from('incident_activity_logs').insert({
      project_id: input.projectId,
      incident_id: null,
      incident_number: 0,
      incident_name: input.title,
      incident_category: 'daily',
      from_status: 'created',
      to_status: 'created',
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_color: actor.color,
      event_type: 'daily_task_created',
      message,
      metadata: {
        taskId: input.taskId,
        relatedTicket: input.relatedTicket,
        taskCount: input.taskCount ?? 1,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording daily task creation log:', error);
  }
}

export async function recordDailyTasksPersisted(input: {
  projectId: string;
  tasksPersisted: number;
  persistedAt: string;
  sourceDate?: string;
  targetDate?: string;
}) {
  try {
    const actor = await loadActivityActor();
    if (!actor) return;

    const { error } = await supabase.from('incident_activity_logs').insert({
      project_id: input.projectId,
      incident_id: null,
      incident_number: 0,
      incident_name: 'Seguimiento diario',
      incident_category: 'daily',
      from_status: 'persisted',
      to_status: 'persisted',
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_color: actor.color,
      event_type: 'daily_tasks_persisted',
      message: `${input.tasksPersisted} tareas persistidas a las ${input.persistedAt} horas.`,
      metadata: {
        tasksPersisted: input.tasksPersisted,
        persistedAt: input.persistedAt,
        sourceDate: input.sourceDate,
        targetDate: input.targetDate,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording daily task persistence log:', error);
  }
}
