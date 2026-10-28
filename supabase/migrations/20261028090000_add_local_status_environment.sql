-- 'Resuelta - En Local' is stored as status_environment = 'LOCAL' so that no
-- COALESCE(..., 'PRO') default can turn it into PRO.

ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_status_environment_check;
ALTER TABLE public.incidents
ADD CONSTRAINT incidents_status_environment_check
CHECK (status_environment IS NULL OR status_environment IN ('LOCAL', 'DEV', 'PRE', 'PRO'));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_environment_check;
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_status_environment_check
CHECK (status_environment IS NULL OR status_environment IN ('LOCAL', 'DEV', 'PRE', 'PRO'));

ALTER TABLE public.incident_assignments DROP CONSTRAINT IF EXISTS incident_assignments_status_environment_check;
ALTER TABLE public.incident_assignments
ADD CONSTRAINT incident_assignments_status_environment_check
CHECK (status_environment IS NULL OR status_environment IN ('LOCAL', 'DEV', 'PRE', 'PRO'));

CREATE OR REPLACE FUNCTION public.sync_incident_status_from_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_incident_id UUID;
  assignment_count INTEGER;
  minimum_status public.incident_status;
  minimum_status_environment TEXT;
BEGIN
  target_incident_id := COALESCE(NEW.incident_id, OLD.incident_id);

  SELECT COUNT(*) INTO assignment_count
  FROM public.incident_assignments
  WHERE incident_id = target_incident_id;

  IF assignment_count = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status
    INTO minimum_status
  FROM public.incident_assignments
  WHERE incident_id = target_incident_id
  ORDER BY CASE status
    WHEN 'pending'::public.incident_status THEN 0
    WHEN 'in_progress'::public.incident_status THEN 1
    WHEN 'blocked'::public.incident_status THEN 2
    WHEN 'resolved'::public.incident_status THEN 3
    WHEN 'in_qa'::public.incident_status THEN 3
    WHEN 'closed'::public.incident_status THEN 4
    ELSE 0
  END
  LIMIT 1;

  IF minimum_status IN ('resolved'::public.incident_status, 'in_qa'::public.incident_status) THEN
    SELECT COALESCE(status_environment, 'PRO')
      INTO minimum_status_environment
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id
      AND status IN ('resolved'::public.incident_status, 'in_qa'::public.incident_status)
    ORDER BY CASE COALESCE(status_environment, 'PRO')
      WHEN 'LOCAL' THEN 0
      WHEN 'DEV' THEN 1
      WHEN 'PRE' THEN 2
      WHEN 'PRO' THEN 3
      ELSE 3
    END
    LIMIT 1;

    UPDATE public.incidents
    SET status = 'resolved'::public.incident_status,
        status_environment = minimum_status_environment,
        updated_at = now()
    WHERE id = target_incident_id;
  ELSE
    UPDATE public.incidents
    SET status = minimum_status,
        status_environment = NULL,
        updated_at = now()
    WHERE id = target_incident_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

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
        WHEN upper(trim(COALESCE(assignment.status_environment, ''))) IN ('LOCAL', 'DEV', 'PRE', 'PRO')
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
          WHEN upper(trim(COALESCE(task.status_environment, ''))) IN ('LOCAL', 'DEV', 'PRE', 'PRO')
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
