import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];

/**
 * Sincroniza el estado de una tarea basándose en los estados de sus asignaciones
 * Reglas:
 * - Si al menos 1 está "En curso" → tarea "En curso" 
 * - Si todos están "Resuelta" → tarea "Resuelta"
 * - Si todos están "Pendiente" → tarea "Pendiente"
 */
export const syncTaskStatus = async (taskId: string): Promise<TaskStatus | null> => {
  try {
    // Obtener todas las asignaciones
    const { data: assignments, error } = await supabase
      .from('task_assignments')
      .select('status')
      .eq('task_id', taskId);

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
    // Mapear task_status a incident_status
    const incidentStatus = status === 'pending' ? 'pending' :
                          status === 'in_progress' ? 'in_progress' :
                          status === 'resolved' ? 'resolved' : 
                          'pending';
    
    await supabase
      .from('incidents')
      .update({ status: incidentStatus as any })
      .eq('id', taskId);
  }
};
