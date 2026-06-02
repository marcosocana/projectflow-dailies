-- Persist daily tasks automatically except those already resolved in PRO.
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
  v_madrid_now := timezone('Europe/Madrid', now());
  v_target_date := v_madrid_now::date;
  v_source_date := CASE
    WHEN EXTRACT(ISODOW FROM v_target_date)::INT = 1 THEN v_target_date - 3
    ELSE v_target_date - 1
  END;
  v_persisted_at := to_char(v_madrid_now, 'HH24:MI');

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
      SELECT dt.task_id
      FROM public.daily_tasks dt
      JOIN public.tasks t ON t.id = dt.task_id
      WHERE dt.daily_id = v_source_daily_id
        AND t.status != 'resolved_yesterday'::public.task_status
        AND NOT (
          t.status = 'resolved'::public.task_status
          AND COALESCE(t.status_environment, 'PRO') = 'PRO'
        )
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
