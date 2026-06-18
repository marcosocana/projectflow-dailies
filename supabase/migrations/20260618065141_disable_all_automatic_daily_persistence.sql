-- Disable every automatic path that can add tasks to a daily.
-- Manual persistence from the UI remains available because it inserts the
-- selected daily_tasks rows explicitly and records the user-facing log.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

SELECT cron.unschedule('persist-daily-tasks-6am') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-6am'
);

SELECT cron.unschedule('persist-daily-tasks-madrid-6am-weekdays') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-madrid-6am-weekdays'
);

DROP TRIGGER IF EXISTS sync_daily_tasks_after_assignment_change ON public.incident_assignments;
DROP TRIGGER IF EXISTS sync_daily_tasks_after_incident_assignee_change ON public.incidents;

CREATE OR REPLACE FUNCTION public.persist_previous_day_tasks(p_force boolean DEFAULT false)
RETURNS TABLE (
  project_id UUID,
  tasks_persisted INT
) AS $$
DECLARE
  v_madrid_now TIMESTAMP;
  v_source_date DATE;
  v_target_date DATE;
  v_source_daily_id UUID;
  v_target_daily_id UUID;
  v_task_record RECORD;
  v_max_order_position INT;
  v_project_id UUID;
  v_rows_for_project INT;
  v_returned_rows BOOLEAN := false;
  v_persisted_at TEXT;
BEGIN
  IF NOT p_force THEN
    RETURN QUERY SELECT NULL::UUID, 0;
    RETURN;
  END IF;

  v_madrid_now := timezone('Europe/Madrid', now());
  v_target_date := v_madrid_now::date;
  v_source_date := CASE
    WHEN EXTRACT(ISODOW FROM v_target_date)::INT = 1 THEN v_target_date - 3
    ELSE v_target_date - 1
  END;
  v_persisted_at := to_char(v_madrid_now, 'HH24:MI');

  FOR v_project_id IN
    SELECT DISTINCT d.project_id
    FROM public.dailies d
    JOIN public.daily_tasks dt ON dt.daily_id = d.id
    WHERE d.date = v_source_date
  LOOP
    v_rows_for_project := 0;

    SELECT d.id INTO v_source_daily_id
    FROM public.dailies d
    WHERE d.project_id = v_project_id
      AND d.date = v_source_date
    LIMIT 1;

    IF v_source_daily_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT d.id INTO v_target_daily_id
    FROM public.dailies d
    WHERE d.project_id = v_project_id
      AND d.date = v_target_date;

    IF v_target_daily_id IS NULL THEN
      INSERT INTO public.dailies (project_id, date, content)
      VALUES (v_project_id, v_target_date, '{}'::jsonb)
      RETURNING id INTO v_target_daily_id;
    END IF;

    SELECT COALESCE(MAX(dt.order_position), -1) INTO v_max_order_position
    FROM public.daily_tasks dt
    WHERE dt.daily_id = v_target_daily_id;

    FOR v_task_record IN
      WITH source_tasks AS (
        SELECT
          dt.task_id,
          t.created_at,
          dt.order_position,
          CASE
            WHEN ia.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
              THEN 'resolved'::public.task_status
            WHEN ia.status = 'blocked'::public.incident_status
              THEN 'blocked'::public.task_status
            WHEN ia.status = 'in_progress'::public.incident_status
              THEN 'in_progress'::public.task_status
            WHEN ia.status = 'pending'::public.incident_status
              THEN 'pending'::public.task_status
            WHEN i.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
              THEN 'resolved'::public.task_status
            WHEN i.status = 'blocked'::public.incident_status
              THEN 'blocked'::public.task_status
            WHEN i.status = 'in_progress'::public.incident_status
              THEN 'in_progress'::public.task_status
            WHEN i.status = 'pending'::public.incident_status
              THEN 'pending'::public.task_status
            ELSE t.status
          END AS effective_status,
          CASE
            WHEN ia.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
              THEN CASE
                WHEN upper(trim(COALESCE(ia.status_environment, ''))) = 'QA' THEN 'PRE'
                WHEN upper(trim(COALESCE(ia.status_environment, ''))) IN ('DEV', 'PRE', 'PRO') THEN upper(trim(ia.status_environment))
                ELSE 'PRO'
              END
            WHEN i.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
              THEN CASE
                WHEN upper(trim(COALESCE(i.status_environment, ''))) = 'QA' THEN 'PRE'
                WHEN upper(trim(COALESCE(i.status_environment, ''))) IN ('DEV', 'PRE', 'PRO') THEN upper(trim(i.status_environment))
                ELSE 'PRO'
              END
            WHEN t.status IN ('resolved'::public.task_status, 'resolved_yesterday'::public.task_status)
              THEN CASE
                WHEN upper(trim(COALESCE(t.status_environment, ''))) = 'QA' THEN 'PRE'
                WHEN upper(trim(COALESCE(t.status_environment, ''))) IN ('DEV', 'PRE', 'PRO') THEN upper(trim(t.status_environment))
                ELSE 'PRO'
              END
            ELSE NULL
          END AS effective_environment
        FROM public.daily_tasks dt
        JOIN public.tasks t ON t.id = dt.task_id
        LEFT JOIN public.incidents i ON i.id = t.incident_id
        LEFT JOIN public.incident_assignments ia
          ON ia.incident_id = t.incident_id
         AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
        WHERE dt.daily_id = v_source_daily_id
      )
      SELECT task_id
      FROM source_tasks
      WHERE effective_status != 'resolved_yesterday'::public.task_status
        AND NOT (
          effective_status = 'resolved'::public.task_status
          AND effective_environment = 'PRO'
        )
      ORDER BY COALESCE(order_position, 999999), created_at
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
      END IF;
    END LOOP;

    UPDATE public.dailies
    SET content = COALESCE(content, '{}'::jsonb) || jsonb_build_object(
      'lastPersistence',
      jsonb_build_object(
        'tasksPersisted', v_rows_for_project,
        'persistedAt', v_persisted_at,
        'sourceDate', v_source_date::text,
        'targetDate', v_target_date::text
      )
    )
    WHERE dailies.id = v_target_daily_id;

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
      v_rows_for_project || ' tareas persistidas a las ' || v_persisted_at || ' horas.',
      jsonb_build_object(
        'tasksPersisted', v_rows_for_project,
        'persistedAt', v_persisted_at,
        'sourceDate', v_source_date::text,
        'targetDate', v_target_date::text
      )
    );

    v_returned_rows := true;
    RETURN QUERY SELECT v_project_id, v_rows_for_project;
  END LOOP;

  IF NOT v_returned_rows THEN
    RETURN QUERY SELECT NULL::UUID, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks(boolean) TO service_role;
