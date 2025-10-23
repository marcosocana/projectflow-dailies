import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];
// Map task_status for syncing with daily tasks
type TaskStatus = Database['public']['Enums']['task_status'];

export interface TaskAssignment {
  id: string;
  incident_id: string;
  assigned_to: string;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
}

export const useTaskAssignments = (taskId: string | null) => {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignments = async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('incident_assignments')
        .select('*')
        .eq('incident_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching task assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    if (!taskId) return;
    const channel = supabase
      .channel(`incident-assignments-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_assignments', filter: `incident_id=eq.${taskId}` },
        () => fetchAssignments()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const addAssignment = async (assignedTo: string, status: IncidentStatus = 'pending') => {
    if (!taskId) return;

    try {
      const { data, error } = await supabase
        .from('incident_assignments')
        .insert({
          incident_id: taskId,
          assigned_to: assignedTo,
          status: status
        })
        .select()
        .single();

      if (error) throw error;
      await fetchAssignments();
      return data;
    } catch (error) {
      console.error('Error adding assignment:', error);
      throw error;
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, status: IncidentStatus) => {
    try {
      // 1) Actualizar el estado de la asignación
      const { error } = await supabase
        .from('incident_assignments')
        .update({ status: status })
        .eq('id', assignmentId);

      if (error) throw error;

      // 2) Buscar la asignación para obtener incidencia y persona
      const { data: assignmentRow } = await supabase
        .from('incident_assignments')
        .select('incident_id, assigned_to')
        .eq('id', assignmentId)
        .maybeSingle();

      if (assignmentRow?.incident_id && assignmentRow?.assigned_to) {
        // 3) Sincronizar las tareas del seguimiento interno vinculadas con esta persona
        const mapped: TaskStatus = status === 'closed' 
          ? 'resolved' 
          : status === 'in_qa' 
            ? 'in_progress' 
            : (status as TaskStatus);

        await supabase
          .from('tasks')
          .update({ status: mapped })
          .eq('incident_id', assignmentRow.incident_id)
          .or(`person_id.eq.${assignmentRow.assigned_to},assigned_to.eq.${assignmentRow.assigned_to}`);

        // 4) Obtener TODAS las asignaciones de esta incidencia para calcular el estado general
        const { data: allAssignments } = await supabase
          .from('incident_assignments')
          .select('status')
          .eq('incident_id', assignmentRow.incident_id);

        if (allAssignments && allAssignments.length > 0) {
          let newIncidentStatus: IncidentStatus = 'pending';

          // Si al menos una está en progreso o en QA, la incidencia está en progreso
          const hasInProgress = allAssignments.some(a => a.status === 'in_progress' || a.status === 'in_qa');
          if (hasInProgress) {
            newIncidentStatus = 'in_progress';
          } 
          // Si todas están resueltas o cerradas, la incidencia está resuelta
          else if (allAssignments.every(a => a.status === 'resolved' || a.status === 'closed')) {
            newIncidentStatus = 'resolved';
          }

          // 5) Actualizar el estado general de la incidencia
          await supabase
            .from('incidents')
            .update({ status: newIncidentStatus })
            .eq('id', assignmentRow.incident_id);
        }
      }

      await fetchAssignments();
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw error;
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('incident_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      await fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      throw error;
    }
  };

  // Calcular el estado general de la tarea basado en los estados de las asignaciones
  const getOverallStatus = (): IncidentStatus => {
    if (assignments.length === 0) return 'pending';
    
    const hasInProgress = assignments.some(a => a.status === 'in_progress');
    if (hasInProgress) return 'in_progress';
    
    const allResolved = assignments.every(a => a.status === 'resolved');
    if (allResolved) return 'resolved';
    
    return 'pending';
  };

  return {
    assignments,
    loading,
    addAssignment,
    updateAssignmentStatus,
    removeAssignment,
    fetchAssignments,
    getOverallStatus
  };
};
