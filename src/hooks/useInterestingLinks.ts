import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InterestingLink {
  id: string;
  project_id: string;
  name: string;
  url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useInterestingLinks(projectId?: string) {
  const [links, setLinks] = useState<InterestingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLinks = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('interesting_links')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
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

  const createLink = async (linkData: Omit<InterestingLink, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('interesting_links')
        .insert([linkData]);

      if (error) throw error;
      
      await fetchLinks();
      toast({
        title: "Éxito",
        description: "Enlace creado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('interesting_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchLinks();
      toast({
        title: "Éxito",
        description: "Enlace eliminado correctamente",
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
    fetchLinks();
  }, [projectId]);

  return {
    links,
    loading,
    createLink,
    deleteLink,
    refetch: fetchLinks,
  };
}