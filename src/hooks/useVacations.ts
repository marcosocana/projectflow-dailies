import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Vacation {
  id: string;
  user_id: string;
  project_id: string;
  person_id?: string;
  start_date: string;
  end_date: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export function useVacations(projectId?: string) {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchVacations = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('vacations')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date');

      if (error) throw error;
      setVacations(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createVacation = async (vacationData: Omit<Vacation, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('vacations')
        .insert([vacationData]);

      if (error) throw error;
      
      await fetchVacations();
      toast({
        title: "Éxito",
        description: "Vacaciones registradas correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateVacation = async (id: string, updates: Partial<Vacation>) => {
    try {
      const { error } = await supabase
        .from('vacations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await fetchVacations();
      toast({
        title: "Éxito",
        description: "Vacaciones actualizadas correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteVacation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchVacations();
      toast({
        title: "Éxito",
        description: "Vacaciones eliminadas correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchVacations();
  }, [projectId]);

  return {
    vacations,
    loading,
    createVacation,
    updateVacation,
    deleteVacation,
    refetch: fetchVacations,
  };
}