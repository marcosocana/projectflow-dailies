import { supabase } from '@/integrations/supabase/client';

type IncidentStatusLogInput = {
  projectId: string;
  incidentId: string;
  incidentNumber: number;
  incidentName: string;
  incidentCategory: string;
  fromStatus: string;
  toStatus: string;
};

async function recordIncidentActivity(input: IncidentStatusLogInput) {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser) return;

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
    const actorColor = profile?.color || '#3B82F6';

    const { error } = await supabase.from('incident_activity_logs').insert({
      project_id: input.projectId,
      incident_id: input.incidentId,
      incident_number: input.incidentNumber,
      incident_name: input.incidentName,
      incident_category: input.incidentCategory,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      actor_user_id: authUser.id,
      actor_name: actorName,
      actor_color: actorColor,
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
