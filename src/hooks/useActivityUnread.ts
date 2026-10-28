import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getActivityLogLastSeen, subscribeToActivityLogReadState } from '@/lib/activityLogReadState';

export const useActivityUnread = (projectId: string | undefined, userId: string | undefined) => {
  const { pathname } = useLocation();
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);

  const refreshUnreadActivity = useCallback(async () => {
    if (!projectId) {
      setHasUnreadActivity(false);
      return;
    }

    const lastSeen = getActivityLogLastSeen(projectId, userId);
    const { data, error } = await supabase
      .from('incident_activity_logs')
      .select('created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.created_at) {
      setHasUnreadActivity(false);
      return;
    }

    setHasUnreadActivity(!lastSeen || new Date(data.created_at).getTime() > new Date(lastSeen).getTime());
  }, [projectId, userId]);

  useEffect(() => {
    refreshUnreadActivity();
  }, [refreshUnreadActivity, pathname]);

  useEffect(() => subscribeToActivityLogReadState(refreshUnreadActivity), [refreshUnreadActivity]);

  useEffect(() => {
    if (!projectId) return undefined;

    const channel = supabase
      .channel(`activity-log-unread-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_activity_logs',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          refreshUnreadActivity();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, refreshUnreadActivity]);

  return hasUnreadActivity;
};
