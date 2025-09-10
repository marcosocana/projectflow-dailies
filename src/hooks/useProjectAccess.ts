import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Project {
  id: string;
  name: string;
  project_number: number;
  theme_color: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithAccess extends Project {
  hasAccess?: boolean;
}

export function useProjectAccess() {
  const [isAccessing, setIsAccessing] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [userProjects, setUserProjects] = useState<ProjectWithAccess[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
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

  const fetchUserProjects = async () => {
    setLoadingProjects(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        setUserProjects([]);
        return [];
      }

      // Primero obtenemos los IDs de proyectos del usuario
      const { data: projectAccess, error: accessError } = await supabase
        .from('project_access')
        .select('project_id')
        .eq('user_id', user.data.user.id);

      if (accessError) throw accessError;

      if (!projectAccess || projectAccess.length === 0) {
        setUserProjects([]);
        return [];
      }

      // Luego obtenemos los datos completos de los proyectos
      const projectIds = projectAccess.map(access => access.project_id);
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, project_number, theme_color, logo_url, created_at, updated_at')
        .in('id', projectIds);

      if (projectsError) throw projectsError;

      const userProjects: ProjectWithAccess[] = projects?.map(project => ({
        ...project,
        hasAccess: true
      })) || [];

      setUserProjects(userProjects);
      return userProjects;
    } catch (error: any) {
      console.error('Error fetching user projects:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los proyectos",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoadingProjects(false);
    }
  };

  const accessProjectDirectly = async (project: ProjectWithAccess) => {
    setCurrentProject(project);
    toast({
      title: "Acceso concedido",
      description: `Bienvenido al proyecto "${project.name}"`,
    });
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
        throw new Error('Contraseña de seguimiento diario incorrecta');
      }

      toast({
        title: "Acceso a seguimiento diario concedido",
        description: "Puedes gestionar el seguimiento diario del proyecto",
      });

      return true;
    } catch (error: any) {
      console.error('Error accessing dailies:', error);
      toast({
        title: "Error de acceso a seguimiento diario",
        description: error.message || "No se pudo acceder al seguimiento diario",
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
    accessProjectDirectly,
    accessDailies,
    leaveProject,
    fetchUserProjects,
    currentProject,
    userProjects,
    isAccessing,
    loadingProjects,
  };
}