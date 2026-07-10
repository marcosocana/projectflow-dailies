import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { formatIncidentReference } from '@/lib/internalTaskIds';
import { mapIncidentStatusToTaskStatus, normalizeEnvironment, type IncidentStatus, type TaskEnvironment } from '@/lib/taskStatus';

type AssignmentSource = {
  assigned_to: string | null;
  status?: IncidentStatus | string | null;
  status_environment?: TaskEnvironment | string | null;
};

const getMadridDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const ensureDaily = async (projectId: string) => {
  const today = getMadridDate();
  const { data: daily, error } = await supabase
    .from('dailies')
    .select('id')
    .eq('project_id', projectId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  if (daily?.id) return daily.id as string;

  const payload: TablesInsert<'dailies'> = { project_id: projectId, date: today, content: {} };
  const { data: created, error: insertError } = await supabase
    .from('dailies')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) throw insertError;
  return created.id as string;
};

const getNextOrderPosition = async (dailyId: string) => {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('order_position')
    .eq('daily_id', dailyId)
    .order('order_position', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? (data[0].order_position || 0) + 1 : 0;
};

export const notifyDailiesTaskCreated = (projectId: string) => {
  window.dispatchEvent(new CustomEvent('dailies-task-created', { detail: { projectId } }));
};

export const ensureDailyTasksForAssignments = async (
  incidentId: string,
  assignmentSources?: AssignmentSource[],
) => {
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .select('id,project_id,name,description,incident_number,category,additional_comments,status,status_environment')
    .eq('id', incidentId)
    .maybeSingle();

  if (incidentError) throw incidentError;
  if (!incident?.project_id) return [];

  let assignments = assignmentSources?.filter((assignment) => assignment.assigned_to) || [];
  if (assignments.length === 0) {
    const { data, error } = await supabase
      .from('incident_assignments')
      .select('assigned_to,status,status_environment')
      .eq('incident_id', incidentId);

    if (error) throw error;
    assignments = (data || []).filter((assignment) => assignment.assigned_to);
  }

  if (assignments.length === 0) return [];

  const dailyId = await ensureDaily(incident.project_id);
  const relatedTicket = formatIncidentReference(incident);
  const ensuredTaskIds: string[] = [];

  for (const assignment of assignments) {
    if (!assignment.assigned_to) continue;

    const taskStatus = mapIncidentStatusToTaskStatus((assignment.status || incident.status || 'pending') as IncidentStatus);
    const taskEnvironment = taskStatus === 'resolved'
      ? normalizeEnvironment(assignment.status_environment || incident.status_environment) || 'PRO'
      : null;

    const { data: existingTasks, error: existingError } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', incident.project_id)
      .eq('incident_id', incidentId)
      .or(`person_id.eq.${assignment.assigned_to},assigned_to.eq.${assignment.assigned_to}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (existingError) throw existingError;

    let taskId = existingTasks?.[0]?.id as string | undefined;

    if (taskId) {
      const updatePayload: TablesUpdate<'tasks'> = {
        title: incident.name,
        description: incident.description || null,
        person_id: assignment.assigned_to,
        assigned_to: assignment.assigned_to,
        status: taskStatus,
        status_environment: taskEnvironment,
        is_auto_linked: true,
        related_ticket: relatedTicket,
      };
      const { error: updateError } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId);

      if (updateError) throw updateError;
    } else {
      const insertPayload: TablesInsert<'tasks'> = {
        title: incident.name,
        description: incident.description || null,
        project_id: incident.project_id,
        daily_id: dailyId,
        incident_id: incidentId,
        person_id: assignment.assigned_to,
        assigned_to: assignment.assigned_to,
        status: taskStatus,
        status_environment: taskEnvironment,
        is_auto_linked: true,
        related_ticket: relatedTicket,
      };
      const { data: created, error: createError } = await supabase
        .from('tasks')
        .insert(insertPayload)
        .select('id')
        .single();

      if (createError) throw createError;
      taskId = created.id;
    }

    const { data: existingLink, error: linkLoadError } = await supabase
      .from('daily_tasks')
      .select('task_id')
      .eq('daily_id', dailyId)
      .eq('task_id', taskId)
      .maybeSingle();

    if (linkLoadError) throw linkLoadError;

    if (!existingLink) {
      const nextPosition = await getNextOrderPosition(dailyId);
      const linkPayload: TablesInsert<'daily_tasks'> = {
        daily_id: dailyId,
        task_id: taskId,
        order_position: nextPosition,
      };
      const { error: linkError } = await supabase
        .from('daily_tasks')
        .upsert(linkPayload, { onConflict: 'daily_id,task_id' });

      if (linkError) throw linkError;
    }

    ensuredTaskIds.push(taskId);
  }

  notifyDailiesTaskCreated(incident.project_id);
  return ensuredTaskIds;
};
