import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Una sola consulta y un solo canal realtime para todas las filas visibles.
export const useIncidentAssignees = (incidentIds: string[]) => {
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});
  const key = incidentIds.join(',');

  useEffect(() => {
    if (!key) {
      setAssignees({});
      return;
    }

    const ids = key.split(',');
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('incident_assignments')
        .select('incident_id,assigned_to')
        .in('incident_id', ids);
      if (!active || error || !data) return;

      const next: Record<string, string[]> = {};
      data.forEach(row => {
        (next[row.incident_id] ||= []).push(row.assigned_to);
      });
      setAssignees(next);
    };

    load();

    const channel = supabase
      .channel(`incident-assignees-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_assignments',
          filter: `incident_id=in.(${ids.join(',')})`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return assignees;
};
