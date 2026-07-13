-- Materialize Home assignments in today's daily only when the frontend asks
-- for it (the "Crear tareas en el seguimiento diario" checkbox).
-- Persistence into later days remains exclusively manual.

CREATE OR REPLACE FUNCTION public.ensure_home_assignments_in_daily(
  p_incident_id UUID,
  p_assigned_to UUID[] DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_assignment RECORD;
  v_daily_id UUID;
  v_task_id UUID;
  v_task_ids UUID[] := ARRAY[]::UUID[];
  v_task_status public.task_status;
  v_status_environment TEXT;
  v_related_ticket TEXT;
  v_next_position INTEGER;
BEGIN
  SELECT id, project_id, name, description, incident_number,
         additional_comments, status, status_environment
    INTO v_incident
  FROM public.incidents
  WHERE id = p_incident_id;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Incident % was not found', p_incident_id;
  END IF;

  INSERT INTO public.dailies (project_id, date, content)
  VALUES (
    v_incident.project_id,
    timezone('Europe/Madrid', now())::date,
    '{}'::jsonb
  )
  ON CONFLICT (project_id, date)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_daily_id;

  v_related_ticket := CASE
    WHEN COALESCE(v_incident.additional_comments, '') LIKE '%[id:int]%'
      THEN 'INT' || v_incident.incident_number::text
    ELSE v_incident.incident_number::text
  END;

  FOR v_assignment IN
    SELECT DISTINCT ON (ia.assigned_to)
      ia.assigned_to,
      ia.status,
      ia.status_environment
    FROM public.incident_assignments ia
    WHERE ia.incident_id = p_incident_id
      AND ia.assigned_to IS NOT NULL
      AND (p_assigned_to IS NULL OR ia.assigned_to = ANY(p_assigned_to))
    ORDER BY ia.assigned_to, ia.created_at
  LOOP
    v_task_status := CASE
      WHEN v_assignment.status IN (
        'resolved'::public.incident_status,
        'closed'::public.incident_status,
        'in_qa'::public.incident_status
      ) THEN 'resolved'::public.task_status
      WHEN v_assignment.status = 'blocked'::public.incident_status
        THEN 'blocked'::public.task_status
      WHEN v_assignment.status = 'in_progress'::public.incident_status
        THEN 'in_progress'::public.task_status
      ELSE 'pending'::public.task_status
    END;

    v_status_environment := CASE
      WHEN v_task_status = 'resolved'::public.task_status
        THEN COALESCE(
          NULLIF(v_assignment.status_environment, ''),
          NULLIF(v_incident.status_environment, ''),
          'PRO'
        )
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
      v_daily_id,
      p_incident_id,
      v_assignment.assigned_to,
      v_assignment.assigned_to,
      v_task_status,
      v_status_environment,
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
      person_id = EXCLUDED.person_id,
      assigned_to = EXCLUDED.assigned_to,
      status = EXCLUDED.status,
      status_environment = EXCLUDED.status_environment,
      is_auto_linked = true,
      related_ticket = EXCLUDED.related_ticket
    RETURNING id INTO v_task_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks
      WHERE daily_id = v_daily_id
        AND task_id = v_task_id
    ) THEN
      SELECT COALESCE(MAX(order_position), -1) + 1
        INTO v_next_position
      FROM public.daily_tasks
      WHERE daily_id = v_daily_id;

      INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
      VALUES (v_daily_id, v_task_id, v_next_position)
      ON CONFLICT (daily_id, task_id) DO NOTHING;
    END IF;

    v_task_ids := array_append(v_task_ids, v_task_id);
  END LOOP;

  RETURN v_task_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_home_assignments_in_daily(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_home_assignments_in_daily(UUID, UUID[]) TO authenticated;
