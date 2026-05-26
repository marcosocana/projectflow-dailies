import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { recordAssignmentStatusChange } from '@/lib/incidentActivityLog';
import { getMinimumIncidentAssignmentState, normalizeEnvironment } from '@/lib/taskStatus';

type IncidentStatus = Database['public']['Enums']['incident_status'];

/**
 * Sincroniza el estado de una tarea basándose en los estados de sus asignaciones
 * Reglas:
 * - Si hay 1 sola asignación: estado bidireccional (asignación ↔ tarea)
 * - Si hay más de 1 asignación:
 *   - Si al menos 1 está "En curso" → tarea "En curso" 
 *   - Si todas tienen el mismo estado → tarea tiene ese estado
 */
export const syncTaskStatus = async (taskId: string): Promise<IncidentStatus | null> => {
  try {
    // Obtener todas las asignaciones
    const { data: assignments, error } = await supabase
      .from('incident_assignments')
      .select('status, status_environment')
      .eq('incident_id', taskId);

    if (error) throw error;
    if (!assignments || assignments.length === 0) return null;

    return getMinimumIncidentAssignmentState(assignments).status as IncidentStatus;
  } catch (error) {
    console.error('Error syncing task status:', error);
    return null;
  }
};

/**
 * Actualiza el estado de una tarea y lo sincroniza en la tabla incidents
 */
export const updateTaskStatusFromAssignments = async (taskId: string): Promise<void> => {
  const { data: assignments } = await supabase
    .from('incident_assignments')
    .select('status, status_environment')
    .eq('incident_id', taskId);

  if (assignments && assignments.length > 0) {
    const nextState = getMinimumIncidentAssignmentState(assignments);
    await supabase
      .from('incidents')
      .update({ status: nextState.status, status_environment: nextState.statusEnvironment } as any)
      .eq('id', taskId);
  }
};

/**
 * Sincroniza el estado de la tarea con las asignaciones cuando hay una sola asignación
 * Si la tarea cambia de estado y solo hay una asignación, actualiza también la asignación
 */
export const syncSingleAssignmentStatus = async (taskId: string, taskStatus: IncidentStatus, statusEnvironment: string | null = null): Promise<void> => {
  try {
    // Obtener todas las asignaciones
    const { data: assignments, error } = await supabase
      .from('incident_assignments')
      .select('id, status, status_environment, assigned_to')
      .eq('incident_id', taskId);

    if (error) throw error;
    
    // Solo sincronizar si hay exactamente una asignación
    if (assignments && assignments.length === 1) {
      const assignment = assignments[0];
      
      // Solo actualizar si el estado es diferente
      if (assignment.status !== taskStatus || normalizeEnvironment((assignment as any).status_environment) !== normalizeEnvironment(statusEnvironment)) {
        const { data: incident } = await supabase
          .from('incidents')
          .select('project_id, incident_number, name, category')
          .eq('id', taskId)
          .maybeSingle();
        const { data: person } = await supabase
          .from('people')
          .select('name')
          .eq('id', (assignment as any).assigned_to)
          .maybeSingle();

        await supabase
          .from('incident_assignments')
          .update({
            status: taskStatus,
            status_environment: taskStatus === 'resolved' ? normalizeEnvironment(statusEnvironment) || 'PRO' : null,
          } as any)
          .eq('id', assignment.id);

        if (incident) {
          await recordAssignmentStatusChange({
            projectId: incident.project_id,
            incidentId: taskId,
            incidentNumber: Number(incident.incident_number),
            incidentName: incident.name,
            incidentCategory: incident.category,
            personName: person?.name || 'Persona asignada',
            fromStatus: assignment.status,
            toStatus: taskStatus,
            fromEnvironment: (assignment as any).status_environment,
            toEnvironment: statusEnvironment,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error syncing single assignment status:', error);
  }
};
