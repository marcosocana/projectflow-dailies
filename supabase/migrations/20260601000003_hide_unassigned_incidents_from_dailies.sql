-- Incidents without current assignment rows must not appear in Seguimiento diario.
-- Legacy incidents.assigned_to can contain an old assignee, so it is no longer
-- used as a fallback for daily task materialization.

WITH stale_tasks AS (
  SELECT t.id
  FROM public.tasks t
  WHERE t.incident_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.incident_assignments ia
      WHERE ia.incident_id = t.incident_id
        AND ia.assigned_to IS NOT NULL
        AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
    )
),
deleted_daily_links AS (
  DELETE FROM public.daily_tasks dt
  USING stale_tasks
  WHERE dt.task_id = stale_tasks.id
  RETURNING dt.task_id
)
DELETE FROM public.tasks t
USING stale_tasks
WHERE t.id = stale_tasks.id;

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
  v_task_status_environment TEXT;
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
        AND ia.assigned_to IS NOT NULL
        AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
    );

  DELETE FROM public.tasks t
  WHERE t.incident_id = p_incident_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.incident_assignments ia
      WHERE ia.incident_id = p_incident_id
        AND ia.assigned_to IS NOT NULL
        AND ia.assigned_to = COALESCE(t.person_id, t.assigned_to)
    );

  FOR v_assignment IN
    SELECT DISTINCT ON (assigned_to) assigned_to, status, status_environment
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
    v_task_status_environment := CASE
      WHEN v_task_status = 'resolved'::public.task_status AND v_assignment.status_environment IN ('DEV', 'PRE', 'PRO') THEN v_assignment.status_environment
      WHEN v_task_status = 'resolved'::public.task_status AND v_incident.status_environment IN ('DEV', 'PRE', 'PRO') THEN v_incident.status_environment
      WHEN v_task_status = 'resolved'::public.task_status THEN 'PRO'
      ELSE NULL
    END;

    INSERT INTO public.tasks (
      title,
      description,
      project_id,
      daily_id,
      incident_id,
      person_id,
      assigned_to,
      status,
      status_environment,
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
      v_task_status_environment,
      true,
      v_related_ticket
    )
    ON CONFLICT (
      project_id,
      incident_id,
      COALESCE(person_id, assigned_to)
    ) WHERE incident_id IS NOT NULL
        AND COALESCE(person_id, assigned_to) IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      project_id = EXCLUDED.project_id,
      incident_id = EXCLUDED.incident_id,
      person_id = EXCLUDED.person_id,
      assigned_to = EXCLUDED.assigned_to,
      status = EXCLUDED.status,
      status_environment = EXCLUDED.status_environment,
      is_auto_linked = true,
      related_ticket = EXCLUDED.related_ticket
    RETURNING id INTO v_task_id;

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
        VALUES (v_daily_id, v_task_id, v_next_order)
        ON CONFLICT (daily_id, task_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
