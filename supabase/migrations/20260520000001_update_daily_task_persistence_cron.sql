DROP FUNCTION IF EXISTS public.persist_previous_day_tasks();

-- Persist daily tasks automatically at 06:00 Europe/Madrid on weekdays.
-- The source is the latest previous daily that has tasks, not necessarily yesterday.
CREATE OR REPLACE FUNCTION public.persist_previous_day_tasks(p_force boolean DEFAULT false)
RETURNS TABLE (
  project_id UUID,
  tasks_persisted INT
) AS $$
DECLARE
  v_madrid_now TIMESTAMP;
  v_target_date DATE;
  v_source_daily_id UUID;
  v_target_daily_id UUID;
  v_task_record RECORD;
  v_max_order_position INT;
  v_project_id UUID;
  v_rows_for_project INT;
  v_total_rows INT := 0;
BEGIN
  v_madrid_now := timezone('Europe/Madrid', now());
  v_target_date := v_madrid_now::date;

  -- Cron is scheduled twice in UTC to cover CET/CEST. Only the run that is
  -- actually 06:00 in Madrid should do work, and never on weekends.
  IF NOT p_force THEN
    IF EXTRACT(ISODOW FROM v_madrid_now)::INT NOT BETWEEN 1 AND 5
       OR EXTRACT(HOUR FROM v_madrid_now)::INT != 6 THEN
      RETURN QUERY SELECT NULL::UUID, 0;
      RETURN;
    END IF;
  END IF;

  FOR v_project_id IN
    SELECT DISTINCT d.project_id
    FROM public.dailies d
    JOIN public.daily_tasks dt ON dt.daily_id = d.id
    WHERE d.date < v_target_date
  LOOP
    v_rows_for_project := 0;

    SELECT d.id INTO v_source_daily_id
    FROM public.dailies d
    WHERE d.project_id = v_project_id
      AND d.date < v_target_date
      AND EXISTS (
        SELECT 1
        FROM public.daily_tasks dt
        WHERE dt.daily_id = d.id
      )
    ORDER BY d.date DESC
    LIMIT 1;

    IF v_source_daily_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_target_daily_id
    FROM public.dailies
    WHERE project_id = v_project_id
      AND date = v_target_date;

    IF v_target_daily_id IS NULL THEN
      INSERT INTO public.dailies (project_id, date, content)
      VALUES (v_project_id, v_target_date, '{}'::jsonb)
      RETURNING id INTO v_target_daily_id;
    END IF;

    SELECT COALESCE(MAX(order_position), -1) INTO v_max_order_position
    FROM public.daily_tasks
    WHERE daily_id = v_target_daily_id;

    FOR v_task_record IN
      SELECT dt.task_id, dt.order_position, t.status
      FROM public.daily_tasks dt
      JOIN public.tasks t ON t.id = dt.task_id
      WHERE dt.daily_id = v_source_daily_id
        AND t.status != 'resolved_yesterday'
      ORDER BY COALESCE(dt.order_position, 999999), t.created_at
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.daily_tasks existing
        WHERE existing.daily_id = v_target_daily_id
          AND existing.task_id = v_task_record.task_id
      ) THEN
        v_max_order_position := v_max_order_position + 1;

        INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
        VALUES (v_target_daily_id, v_task_record.task_id, v_max_order_position);

        v_rows_for_project := v_rows_for_project + 1;
        v_total_rows := v_total_rows + 1;
      END IF;
    END LOOP;

    -- Tasks resolved in the source daily are carried over as "Resuelta ayer";
    -- future persistence runs will exclude them.
    UPDATE public.tasks t
    SET status = 'resolved_yesterday'
    FROM public.daily_tasks dt
    WHERE dt.daily_id = v_source_daily_id
      AND dt.task_id = t.id
      AND t.status = 'resolved';

    RETURN QUERY SELECT v_project_id, v_rows_for_project;
  END LOOP;

  IF v_total_rows = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks(boolean) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO postgres;

SELECT cron.unschedule('persist-daily-tasks-6am') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-6am'
);

SELECT cron.unschedule('persist-daily-tasks-madrid-6am-weekdays') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-madrid-6am-weekdays'
);

-- Runs at 04:00 and 05:00 UTC from Monday to Friday. The function itself
-- checks Europe/Madrid local time, so exactly one of those executions persists.
SELECT cron.schedule(
  'persist-daily-tasks-madrid-6am-weekdays',
  '0 4,5 * * 1-5',
  'SELECT public.persist_previous_day_tasks();'
);
