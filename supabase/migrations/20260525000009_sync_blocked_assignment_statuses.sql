CREATE OR REPLACE FUNCTION public.sync_incident_status_from_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_incident_id UUID;
  assignment_count INTEGER;
  distinct_statuses INTEGER;
  common_status public.incident_status;
  resolved_environment TEXT;
BEGIN
  target_incident_id := COALESCE(NEW.incident_id, OLD.incident_id);

  SELECT COUNT(*) INTO assignment_count
  FROM public.incident_assignments
  WHERE incident_id = target_incident_id;

  IF assignment_count = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id
      AND status = 'in_progress'::public.incident_status
  ) THEN
    UPDATE public.incidents
    SET status = 'in_progress'::public.incident_status,
        environment = NULL,
        updated_at = now()
    WHERE id = target_incident_id;
  ELSIF EXISTS (
    SELECT 1
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id
      AND status = 'blocked'::public.incident_status
  ) THEN
    UPDATE public.incidents
    SET status = 'blocked'::public.incident_status,
        environment = NULL,
        updated_at = now()
    WHERE id = target_incident_id;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id
      AND status NOT IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
  ) THEN
    SELECT COALESCE(
      MAX(environment) FILTER (WHERE environment IN ('DEV', 'PRE', 'PRO')),
      'PRO'
    )
    INTO resolved_environment
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id;

    UPDATE public.incidents
    SET status = 'resolved'::public.incident_status,
        environment = resolved_environment,
        updated_at = now()
    WHERE id = target_incident_id;
  ELSE
    SELECT COUNT(DISTINCT status) INTO distinct_statuses
    FROM public.incident_assignments
    WHERE incident_id = target_incident_id;

    IF distinct_statuses = 1 THEN
      SELECT status INTO common_status
      FROM public.incident_assignments
      WHERE incident_id = target_incident_id
      LIMIT 1;

      UPDATE public.incidents
      SET status = common_status,
          environment = NULL,
          updated_at = now()
      WHERE id = target_incident_id;
    ELSE
      UPDATE public.incidents
      SET status = 'pending'::public.incident_status,
          environment = NULL,
          updated_at = now()
      WHERE id = target_incident_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_daily_tasks_for_incident_assignments(p_incident_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_today DATE := timezone('Europe/Madrid', now())::date;
  v_today_daily_id UUID;
  v_daily_ids UUID[];
  v_assignment RECORD;
  v_task_id UUID;
  v_related_ticket TEXT;
  v_task_status public.task_status;
  v_task_environment TEXT;
  v_daily_id UUID;
  v_next_order INT;
BEGIN
  IF p_incident_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
    INTO v_incident
  FROM public.incidents
  WHERE id = p_incident_id;

  IF v_incident.id IS NULL THEN
    RETURN;
  END IF;

  SELECT id
    INTO v_today_daily_id
  FROM public.dailies
  WHERE project_id = v_incident.project_id
    AND date = v_today;

  IF v_today_daily_id IS NULL THEN
    INSERT INTO public.dailies (project_id, date, content)
    VALUES (v_incident.project_id, v_today, '{}'::jsonb)
    RETURNING id INTO v_today_daily_id;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT daily_id
    FROM (
      SELECT v_today_daily_id AS daily_id
      UNION
      SELECT dt.daily_id
      FROM public.daily_tasks dt
      JOIN public.tasks t ON t.id = dt.task_id
      WHERE t.incident_id = p_incident_id
    ) source
    WHERE daily_id IS NOT NULL
  ) INTO v_daily_ids;

  v_related_ticket := CASE
    WHEN COALESCE(v_incident.additional_comments, '') LIKE '%[id:int]%'
      THEN 'INT' || v_incident.incident_number::text
    ELSE v_incident.incident_number::text
  END;

  DELETE FROM public.daily_tasks dt
  USING public.tasks t
  WHERE dt.task_id = t.id
    AND t.incident_id = p_incident_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.incident_assignments ia
      WHERE ia.incident_id = p_incident_id
        AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
    );

  DELETE FROM public.tasks t
  WHERE t.incident_id = p_incident_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.incident_assignments ia
      WHERE ia.incident_id = p_incident_id
        AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
    );

  FOR v_assignment IN
    SELECT DISTINCT ON (assigned_to) assigned_to, status, environment
    FROM public.incident_assignments
    WHERE incident_id = p_incident_id
      AND assigned_to IS NOT NULL
    ORDER BY assigned_to, created_at
  LOOP
    v_task_status := CASE
      WHEN v_assignment.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
        THEN 'resolved'::public.task_status
      WHEN v_assignment.status = 'blocked'::public.incident_status
        THEN 'blocked'::public.task_status
      WHEN v_assignment.status = 'in_progress'::public.incident_status
        THEN 'in_progress'::public.task_status
      ELSE 'pending'::public.task_status
    END;
    v_task_environment := CASE
      WHEN v_task_status = 'resolved'::public.task_status AND v_assignment.environment IN ('DEV', 'PRE', 'PRO') THEN v_assignment.environment
      WHEN v_task_status = 'resolved'::public.task_status AND v_incident.environment IN ('DEV', 'PRE', 'PRO') THEN v_incident.environment
      WHEN v_task_status = 'resolved'::public.task_status THEN 'PRO'
      ELSE NULL
    END;

    SELECT id
      INTO v_task_id
    FROM public.tasks
    WHERE incident_id = p_incident_id
      AND COALESCE(person_id, assigned_to) = v_assignment.assigned_to
    ORDER BY created_at
    LIMIT 1;

    IF v_task_id IS NULL THEN
      INSERT INTO public.tasks (
        title,
        description,
        project_id,
        daily_id,
        incident_id,
        person_id,
        assigned_to,
        status,
        environment,
        is_auto_linked,
        related_ticket
      ) VALUES (
        v_incident.name,
        v_incident.description,
        v_incident.project_id,
        v_today_daily_id,
        p_incident_id,
        v_assignment.assigned_to,
        v_assignment.assigned_to,
        v_task_status,
        v_task_environment,
        true,
        v_related_ticket
      )
      RETURNING id INTO v_task_id;
    ELSE
      UPDATE public.tasks
      SET title = v_incident.name,
          description = v_incident.description,
          project_id = v_incident.project_id,
          incident_id = p_incident_id,
          person_id = v_assignment.assigned_to,
          assigned_to = v_assignment.assigned_to,
          status = v_task_status,
          environment = v_task_environment,
          is_auto_linked = true,
          related_ticket = v_related_ticket
      WHERE id = v_task_id;
    END IF;

    FOREACH v_daily_id IN ARRAY v_daily_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.daily_tasks
        WHERE daily_id = v_daily_id
          AND task_id = v_task_id
      ) THEN
        SELECT COALESCE(MAX(order_position), -1) + 1
          INTO v_next_order
        FROM public.daily_tasks
        WHERE daily_id = v_daily_id;

        INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
        VALUES (v_daily_id, v_task_id, v_next_order);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_incident_id UUID;
BEGIN
  FOR v_incident_id IN
    SELECT DISTINCT incident_id
    FROM public.incident_assignments
    WHERE incident_id IS NOT NULL
  LOOP
    PERFORM public.sync_daily_tasks_for_incident_assignments(v_incident_id);
  END LOOP;
END;
$$;
