DO $$
DECLARE
  project_row RECORD;
  actor_row RECORD;
  inc1 RECORD;
  inc2 RECORD;
BEGIN
  SELECT id
    INTO project_row
  FROM public.projects
  WHERE name = 'Moeve GMA'
  ORDER BY created_at ASC
  LIMIT 1;

  IF project_row.id IS NULL THEN
    SELECT id
      INTO project_row
    FROM public.projects
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  SELECT user_id, full_name, color
    INTO actor_row
  FROM public.profiles
  WHERE user_id IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id, incident_number, name, category
    INTO inc1
  FROM public.incidents
  WHERE project_id = project_row.id
  ORDER BY incident_number ASC
  LIMIT 1;

  SELECT id, incident_number, name, category
    INTO inc2
  FROM public.incidents
  WHERE project_id = project_row.id
  ORDER BY incident_number DESC
  LIMIT 1;

  IF inc1.id IS NOT NULL THEN
    INSERT INTO public.incident_activity_logs (
      id,
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
      created_at
    ) VALUES (
      gen_random_uuid(),
      project_row.id,
      inc1.id,
      inc1.incident_number,
      inc1.name,
      COALESCE(inc1.category, 'incident'),
      'pending',
      'in_progress',
      actor_row.user_id,
      COALESCE(actor_row.full_name, 'Usuario'),
      COALESCE(actor_row.color, '#3B82F6'),
      TIMESTAMPTZ '2026-05-18 08:15:00+02'
    );
  END IF;

  IF inc2.id IS NOT NULL AND inc2.id <> inc1.id THEN
    INSERT INTO public.incident_activity_logs (
      id,
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
      created_at
    ) VALUES (
      gen_random_uuid(),
      project_row.id,
      inc2.id,
      inc2.incident_number,
      inc2.name,
      COALESCE(inc2.category, 'incident'),
      'in_progress',
      'resolved',
      actor_row.user_id,
      COALESCE(actor_row.full_name, 'Usuario'),
      COALESCE(actor_row.color, '#3B82F6'),
      TIMESTAMPTZ '2026-05-18 11:42:00+02'
    );
  END IF;
END $$;
