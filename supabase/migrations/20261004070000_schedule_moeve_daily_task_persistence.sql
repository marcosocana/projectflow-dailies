-- Persist the previous business day's Moeve GMA tasks automatically at 07:00
-- Europe/Madrid from Monday to Friday. The work itself is idempotent, so a
-- manual persistence before the scheduled run cannot create duplicate links.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.persist_moeve_daily_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_madrid_now TIMESTAMP := timezone('Europe/Madrid', now());
  v_project_id UUID;
  v_source_date DATE;
  v_target_date DATE;
  v_source_daily_id UUID;
  v_target_daily_id UUID;
  v_max_order_position INTEGER;
  v_task_record RECORD;
  v_tasks_persisted INTEGER := 0;
  v_persisted_at TEXT;
BEGIN
  SELECT id
  INTO v_project_id
  FROM public.projects
  WHERE name = 'Moeve GMA'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el proyecto Moeve GMA';
  END IF;

  v_target_date := v_madrid_now::DATE;
  v_source_date := CASE
    WHEN EXTRACT(ISODOW FROM v_target_date)::INTEGER = 1 THEN v_target_date - 3
    ELSE v_target_date - 1
  END;
  v_persisted_at := to_char(v_madrid_now, 'HH24:MI');

  SELECT id
  INTO v_source_daily_id
  FROM public.dailies
  WHERE project_id = v_project_id
    AND date = v_source_date;

  IF v_source_daily_id IS NULL THEN
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
      'persisted',
      'persisted',
      NULL,
      'Sistema',
      '#3B82F6',
      'daily_tasks_persisted',
      'Persistencia automática: no había tareas para el día laborable anterior.',
      jsonb_build_object(
        'automatic', true,
        'tasksPersisted', 0,
        'persistedAt', v_persisted_at,
        'sourceDate', v_source_date::TEXT,
        'targetDate', v_target_date::TEXT
      )
    );
    RETURN 0;
  END IF;

  -- Synchronize linked task status with its assignment before selecting tasks,
  -- matching the synchronization performed by the Persistir dialog.
  UPDATE public.tasks AS task
  SET
    status = CASE
      WHEN assignment.status IN ('resolved', 'closed', 'in_qa') THEN 'resolved'::public.task_status
      WHEN assignment.status = 'blocked' THEN 'blocked'::public.task_status
      WHEN assignment.status = 'in_progress' THEN 'in_progress'::public.task_status
      ELSE 'pending'::public.task_status
    END,
    status_environment = CASE
      WHEN assignment.status IN ('resolved', 'closed', 'in_qa') THEN CASE
        WHEN upper(trim(COALESCE(assignment.status_environment, ''))) = 'QA' THEN 'PRE'
        WHEN upper(trim(COALESCE(assignment.status_environment, ''))) IN ('DEV', 'PRE', 'PRO')
          THEN upper(trim(assignment.status_environment))
        ELSE 'PRO'
      END
      ELSE NULL
    END
  FROM public.daily_tasks AS source_link,
       public.incident_assignments AS assignment
  WHERE source_link.daily_id = v_source_daily_id
    AND source_link.task_id = task.id
    AND task.incident_id IS NOT NULL
    AND assignment.incident_id = task.incident_id
    AND assignment.assigned_to = COALESCE(task.person_id, task.assigned_to);

  INSERT INTO public.dailies (project_id, date, content)
  VALUES (v_project_id, v_target_date, '{}'::JSONB)
  ON CONFLICT (project_id, date) DO NOTHING
  RETURNING id INTO v_target_daily_id;

  IF v_target_daily_id IS NULL THEN
    SELECT id
    INTO v_target_daily_id
    FROM public.dailies
    WHERE project_id = v_project_id
      AND date = v_target_date;
  END IF;

  SELECT COALESCE(MAX(order_position), -1)
  INTO v_max_order_position
  FROM public.daily_tasks
  WHERE daily_id = v_target_daily_id;

  FOR v_task_record IN
    SELECT task.id
    FROM public.daily_tasks AS source_link
    JOIN public.tasks AS task ON task.id = source_link.task_id
    WHERE source_link.daily_id = v_source_daily_id
      -- A linked task without its assigned person is removed by the UI sync,
      -- so it is not eligible for automatic persistence either.
      AND (
        task.incident_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.incident_assignments AS assignment
          WHERE assignment.incident_id = task.incident_id
            AND assignment.assigned_to = COALESCE(task.person_id, task.assigned_to)
        )
      )
      AND NOT (
        task.status IN ('resolved', 'resolved_yesterday')
        AND CASE
          WHEN upper(trim(COALESCE(task.status_environment, ''))) = 'QA' THEN 'PRE'
          WHEN upper(trim(COALESCE(task.status_environment, ''))) IN ('DEV', 'PRE', 'PRO')
            THEN upper(trim(task.status_environment))
          ELSE 'PRO'
        END = 'PRO'
      )
    ORDER BY COALESCE(source_link.order_position, 999999), task.created_at
  LOOP
    INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
    VALUES (v_target_daily_id, v_task_record.id, v_max_order_position + 1)
    ON CONFLICT (daily_id, task_id) DO NOTHING;

    IF FOUND THEN
      v_max_order_position := v_max_order_position + 1;
      v_tasks_persisted := v_tasks_persisted + 1;
    END IF;
  END LOOP;

  UPDATE public.dailies
  SET content = COALESCE(content, '{}'::JSONB) || jsonb_build_object(
    'lastPersistence',
    jsonb_build_object(
      'automatic', true,
      'tasksPersisted', v_tasks_persisted,
      'persistedAt', v_persisted_at,
      'sourceDate', v_source_date::TEXT,
      'targetDate', v_target_date::TEXT
    )
  )
  WHERE id = v_target_daily_id;

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
    'persisted',
    'persisted',
    NULL,
    'Sistema',
    '#3B82F6',
    'daily_tasks_persisted',
    format('Persistencia automática: %s tareas persistidas a las %s horas.', v_tasks_persisted, v_persisted_at),
    jsonb_build_object(
      'automatic', true,
      'tasksPersisted', v_tasks_persisted,
      'persistedAt', v_persisted_at,
      'sourceDate', v_source_date::TEXT,
      'targetDate', v_target_date::TEXT
    )
  );

  RETURN v_tasks_persisted;
END;
$$;

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
     OR EXTRACT(HOUR FROM v_madrid_now)::INTEGER != 7 THEN
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

REVOKE ALL ON FUNCTION public.persist_moeve_daily_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_moeve_daily_task_persistence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_moeve_daily_tasks() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_moeve_daily_task_persistence() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'persist-moeve-daily-tasks-7am-weekdays';

-- 07:00 in Madrid is 05:00 UTC during CEST and 06:00 UTC during CET. The
-- function checks local time, so exactly one scheduled execution does work.
SELECT cron.schedule(
  'persist-moeve-daily-tasks-7am-weekdays',
  '0 5,6 * * 1-5',
  'SELECT public.run_moeve_daily_task_persistence();'
);