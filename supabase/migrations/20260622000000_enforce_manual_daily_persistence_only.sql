-- Daily task persistence is exclusively initiated by the Persistir button.
-- The UI inserts the selected daily_tasks links directly, so no database RPC
-- or scheduled job is needed for manual persistence.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%persist_previous_day_tasks%'
       OR command ILIKE '%persist-daily-tasks%'
       OR jobname ILIKE '%persist%daily%task%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS sync_daily_tasks_after_assignment_change ON public.incident_assignments;
DROP TRIGGER IF EXISTS sync_daily_tasks_after_incident_assignee_change ON public.incidents;

DROP FUNCTION IF EXISTS public.persist_previous_day_tasks();
DROP FUNCTION IF EXISTS public.persist_previous_day_tasks(boolean);
