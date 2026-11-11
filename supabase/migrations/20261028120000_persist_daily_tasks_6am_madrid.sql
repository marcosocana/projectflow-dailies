-- Automatic Persistir at 06:00 Europe/Madrid, Monday to Friday.
-- Replaces the 'auto-persist-daily-tasks-6am-weekdays' job, whose function
-- called a missing RPC and wrote to a missing table; its EXCEPTION handler
-- rolled everything back and only emitted a WARNING, so it never persisted.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
  'auto-persist-daily-tasks-6am-weekdays',
  'persist-moeve-daily-tasks-7am-weekdays',
  'persist-moeve-daily-tasks-6am-weekdays'
);

DROP FUNCTION IF EXISTS public.cron_persist_daily_tasks();

CREATE OR REPLACE FUNCTION public.run_moeve_daily_task_persistence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_madrid_now TIMESTAMP := timezone('Europe/Madrid', now());
  v_project_id UUID;
  v_attempt INTEGER;
  v_error_message TEXT;
BEGIN
  IF EXTRACT(ISODOW FROM v_madrid_now)::INTEGER NOT BETWEEN 1 AND 5
     OR EXTRACT(HOUR FROM v_madrid_now)::INTEGER != 6 THEN
    RETURN;
  END IF;

  SELECT id
  INTO v_project_id
  FROM public.projects
  WHERE name = 'Moeve GMA'
  LIMIT 1;

  FOR v_attempt IN 1..4 LOOP
    BEGIN
      PERFORM public.persist_moeve_daily_tasks();
      RETURN;
    EXCEPTION WHEN OTHERS THEN
      v_error_message := SQLERRM;
      IF v_attempt < 4 THEN
        PERFORM pg_sleep(60);
      END IF;
    END;
  END LOOP;

  IF v_project_id IS NOT NULL THEN
    INSERT INTO public.incident_activity_logs (
      project_id,
      incident_id,
      incident_number,
      incident_name,
      incident_category,
      from_status,
      to_status,
      actor_user_id,
      actor_name,
      actor_color,
      event_type,
      message,
      metadata
    ) VALUES (
      v_project_id,
      NULL,
      0,
      'Seguimiento diario',
      'daily',
      'failed',
      'failed',
      NULL,
      'Sistema',
      '#EF4444',
      'daily_tasks_persistence_failed',
      'La persistencia automática falló tras 4 intentos.',
      jsonb_build_object(
        'automatic', true,
        'attempts', 4,
        'error', v_error_message,
        'scheduledFor', to_char(v_madrid_now, 'YYYY-MM-DD HH24:MI')
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.run_moeve_daily_task_persistence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_moeve_daily_task_persistence() TO service_role;

-- 06:00 in Madrid is 04:00 UTC during CEST and 05:00 UTC during CET. The
-- function checks local time, so exactly one scheduled execution does work.
SELECT cron.schedule(
  'persist-moeve-daily-tasks-6am-weekdays',
  '0 4,5 * * 1-5',
  'SELECT public.run_moeve_daily_task_persistence();'
);
