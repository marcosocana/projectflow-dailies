import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];

/**
 * Sincroniza el estado de una tarea basándose en los estados de sus asignaciones
 * Reglas:
 * - Si al menos 1 está "En curso" → tarea "En curso" 
 * - Si todos están "Resuelta" → tarea "Resuelta"
 * - Si todos están "Pendiente" → tarea "Pendiente"
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

    // Calcular el estado general
    const hasInProgress = assignments.some(a => a.status === 'in_progress');
    if (hasInProgress) return 'in_progress';

    const allResolved = assignments.every(a => a.status === 'resolved');
    if (allResolved) return 'resolved';

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
