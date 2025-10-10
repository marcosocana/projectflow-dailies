import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];

export interface TaskAssignment {
  id: string;
  task_id: string;
  assigned_to: string;
  status: TaskStatus;
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
        .from('task_assignments')
        .select('*')
        .eq('task_id', taskId)
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
  }, [taskId]);

  const addAssignment = async (assignedTo: string, status: TaskStatus = 'pending') => {
    if (!taskId) return;

    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          assigned_to: assignedTo,
          status
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

  const updateAssignmentStatus = async (assignmentId: string, status: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({ status })
        .eq('id', assignmentId);

      if (error) throw error;
      await fetchAssignments();
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw error;
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
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
  const getOverallStatus = (): TaskStatus => {
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
