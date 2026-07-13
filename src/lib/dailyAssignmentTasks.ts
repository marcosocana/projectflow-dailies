import { supabase } from '@/integrations/supabase/client';
import type { IncidentStatus, TaskEnvironment } from '@/lib/taskStatus';

type AssignmentSource = {
  assigned_to: string | null;
  status?: IncidentStatus | string | null;
  status_environment?: TaskEnvironment | string | null;
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
    .select('project_id')
    .eq('id', incidentId)
    .maybeSingle();

  if (incidentError) throw incidentError;
  if (!incident?.project_id) return [];

  const assignedTo = assignmentSources
    ? Array.from(new Set(assignmentSources.map((assignment) => assignment.assigned_to).filter(Boolean))) as string[]
    : null;

  if (assignmentSources && assignedTo.length === 0) return [];

  const { data: ensuredTaskIds, error } = await supabase.rpc('ensure_home_assignments_in_daily', {
    p_incident_id: incidentId,
    p_assigned_to: assignedTo,
  });

  if (error) throw error;

  notifyDailiesTaskCreated(incident.project_id);
  return ensuredTaskIds || [];
};
