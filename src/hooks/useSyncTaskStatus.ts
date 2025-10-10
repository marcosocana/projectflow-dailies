import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

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
      .select('status')
      .eq('incident_id', taskId);

    if (error) throw error;
    if (!assignments || assignments.length === 0) return null;

    // Si hay una sola asignación, devolver su estado directamente
    if (assignments.length === 1) {
      return assignments[0].status;
    }

    // Si hay más de una asignación, aplicar la lógica de prioridad
    const hasInProgress = assignments.some(a => a.status === 'in_progress');
    if (hasInProgress) return 'in_progress';

    // Verificar si todas las asignaciones tienen el mismo estado
    const uniqueStatuses = [...new Set(assignments.map(a => a.status))];
    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0];
    }

    // Si hay estados mixtos (sin "in_progress"), mantener "pending"
    return 'pending';
  } catch (error) {
    console.error('Error syncing task status:', error);
    return null;
  }
};

/**
 * Actualiza el estado de una tarea y lo sincroniza en la tabla incidents
 */
export const updateTaskStatusFromAssignments = async (taskId: string): Promise<void> => {
  const status = await syncTaskStatus(taskId);
  
  if (status) {
    await supabase
      .from('incidents')
      .update({ status: status })
      .eq('id', taskId);
  }
};

/**
 * Sincroniza el estado de la tarea con las asignaciones cuando hay una sola asignación
 * Si la tarea cambia de estado y solo hay una asignación, actualiza también la asignación
 */
export const syncSingleAssignmentStatus = async (taskId: string, taskStatus: IncidentStatus): Promise<void> => {
  try {
    // Obtener todas las asignaciones
    const { data: assignments, error } = await supabase
      .from('incident_assignments')
      .select('id, status')
      .eq('incident_id', taskId);

    if (error) throw error;
    
    // Solo sincronizar si hay exactamente una asignación
    if (assignments && assignments.length === 1) {
      const assignment = assignments[0];
      
      // Solo actualizar si el estado es diferente
      if (assignment.status !== taskStatus) {
        await supabase
          .from('incident_assignments')
          .update({ status: taskStatus })
          .eq('id', assignment.id);
      }
    }
  } catch (error) {
    console.error('Error syncing single assignment status:', error);
  }
};
