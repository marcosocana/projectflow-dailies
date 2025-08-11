import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserPermission {
  id: string;
  user_id: string;
  project_id: string;
  section: string;
  can_access: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserPermissions(projectId?: string) {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPermissions = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los permisos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (userId: string, section: string, canAccess: boolean) => {
    if (!projectId) return;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          project_id: projectId,
          section,
          can_access: canAccess,
        }, {
          onConflict: 'user_id,project_id,section'
        });

      if (error) throw error;
      
      await fetchPermissions();
      
      toast({
        title: "Permisos actualizados",
        description: "Los permisos se han actualizado correctamente",
      });
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los permisos",
        variant: "destructive",
      });
    }
  };

  const getUserPermissions = (userId: string) => {
    return permissions.filter(p => p.user_id === userId);
  };

  const hasPermission = (userId: string, section: string) => {
    const permission = permissions.find(p => p.user_id === userId && p.section === section);
    return permission?.can_access || false;
  };

  useEffect(() => {
    fetchPermissions();
  }, [projectId]);

  return {
    permissions,
    loading,
    updatePermission,
    getUserPermissions,
    hasPermission,
    refetch: fetchPermissions,
  };
}