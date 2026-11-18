import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Rol de cada persona del proyecto (id de persona -> rol), sin nombres.
 * Lo usa la vista Cliente, que no puede leer la tabla people.
 */
export const useProjectPeopleRoles = (projectId: string | null | undefined, enabled: boolean) => {
  const [roleByPersonId, setRoleByPersonId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || !projectId) {
      setRoleByPersonId({});
      return;
    }

    let active = true;

    const load = async () => {
      const { data, error } = await (supabase.rpc as any)('get_project_people_roles', { _project_id: projectId });
      if (!active) return;
      if (error) {
        console.error('Error fetching people roles:', error);
        return;
      }

      const next: Record<string, string> = {};
      ((data || []) as Array<{ person_id: string; role: string | null }>).forEach(row => {
        if (row.role) next[row.person_id] = row.role;
      });
      setRoleByPersonId(next);
    };

    load();

    return () => {
      active = false;
    };
  }, [projectId, enabled]);

  return roleByPersonId;
};
