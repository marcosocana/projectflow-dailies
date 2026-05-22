import { supabase } from '@/integrations/supabase/client';

export const INTERNAL_TASK_ID_MARKER = '[id:int]';

export const formatInternalTaskId = (value: number) => `INT${value}`;

export const cleanInternalTaskIdMarker = (value: string | null | undefined) =>
  String(value ?? '').replace(INTERNAL_TASK_ID_MARKER, '').trim();

export const hasInternalTaskIdMarker = (value: string | null | undefined) =>
  String(value ?? '').includes(INTERNAL_TASK_ID_MARKER);

export const formatIncidentReference = (
  incident: { incident_number?: string | number | null; additional_comments?: string | null } | null | undefined,
) => {
  const value = incident?.incident_number;
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (hasInternalTaskIdMarker(incident?.additional_comments) && Number.isFinite(number)) {
    return formatInternalTaskId(number);
  }
  return String(value);
};

const extractInternalTaskNumber = (value: string | number | null | undefined) => {
  const match = String(value ?? '').trim().match(/^INT(\d+)$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function loadNextInternalTaskId(projectId: string) {
  const [{ data: taskRows }, { data: incidentRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select('related_ticket')
      .eq('project_id', projectId),
    supabase
      .from('incidents')
      .select('incident_number, additional_comments')
      .eq('project_id', projectId)
      .ilike('additional_comments', `%${INTERNAL_TASK_ID_MARKER}%`),
  ]);

  const taskNumbers = (taskRows || [])
    .map(row => extractInternalTaskNumber(row.related_ticket))
    .filter((value): value is number => value !== null);

  const incidentNumbers = (incidentRows || [])
    .map(row => Number(row.incident_number))
    .filter(value => Number.isFinite(value));

  const nextNumber = Math.max(0, ...taskNumbers, ...incidentNumbers) + 1;

  return {
    number: nextNumber,
    label: formatInternalTaskId(nextNumber),
  };
}
