import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Release {
  id: string;
  project_id: string;
  platform: 'web' | 'app';
  environment: 'dev' | 'pre' | 'pro';
  version: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useReleases(projectId?: string) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReleases = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('releases')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReleases(data as Release[] || []);
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

  const createRelease = async (releaseData: Omit<Release, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('releases')
        .insert([releaseData]);

      if (error) throw error;
      
      await fetchReleases();
      toast({
        title: "Éxito",
        description: "Release creado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateRelease = async (id: string, releaseData: Partial<Omit<Release, 'id' | 'created_at' | 'updated_at' | 'project_id'>>) => {
    try {
      const { error } = await supabase
        .from('releases')
        .update(releaseData)
        .eq('id', id);

      if (error) throw error;
      
      await fetchReleases();
      toast({
        title: "Éxito",
        description: "Release actualizado correctamente",
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
    fetchReleases();
  }, [projectId]);

  return {
    releases,
    loading,
    createRelease,
    updateRelease,
    refetch: fetchReleases,
  };
}