import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Project {
  id: string;
  name: string;
  project_number: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectAccess() {
  const [isAccessing, setIsAccessing] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const { toast } = useToast();

  const accessProject = async (password: string) => {
    setIsAccessing(true);
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_password', password)
        .maybeSingle();

      if (error) {
        throw new Error('Error al buscar el proyecto');
      }

      if (!project) {
        throw new Error('Contraseña incorrecta');
      }

      setCurrentProject(project);
      
      toast({
        title: "Acceso concedido",
        description: `Bienvenido al proyecto "${project.name}"`,
      });

      return project;
    } catch (error: any) {
      console.error('Error accessing project:', error);
      toast({
        title: "Error de acceso",
        description: error.message || "No se pudo acceder al proyecto",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsAccessing(false);
    }
  };

  const accessDailies = async (projectId: string, dailiesPassword: string) => {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('dailies_password')
        .eq('id', projectId)
        .single();

      if (error || !project) {
        throw new Error('Proyecto no encontrado');
      }

      if (project.dailies_password !== dailiesPassword) {
        throw new Error('Contraseña de dailies incorrecta');
      }

      toast({
        title: "Acceso a dailies concedido",
        description: "Puedes gestionar las dailies del proyecto",
      });

      return true;
    } catch (error: any) {
      console.error('Error accessing dailies:', error);
      toast({
        title: "Error de acceso a dailies",
        description: error.message || "No se pudo acceder a las dailies",
        variant: "destructive",
      });
      throw error;
    }
  };

  const leaveProject = () => {
    setCurrentProject(null);
  };

  return {
    accessProject,
    accessDailies,
    leaveProject,
    currentProject,
    isAccessing,
  };
}