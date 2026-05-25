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
      WHEN 'DEV' THEN 0
      WHEN 'PRE' THEN 1
      WHEN 'PRO' THEN 2
      ELSE 2
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

WITH ranked_assignments AS (
  SELECT DISTINCT ON (incident_id)
    incident_id,
    status AS minimum_status
  FROM public.incident_assignments
  WHERE incident_id IS NOT NULL
  ORDER BY incident_id, CASE status
    WHEN 'pending'::public.incident_status THEN 0
    WHEN 'in_progress'::public.incident_status THEN 1
    WHEN 'blocked'::public.incident_status THEN 2
    WHEN 'resolved'::public.incident_status THEN 3
    WHEN 'in_qa'::public.incident_status THEN 3
    WHEN 'closed'::public.incident_status THEN 4
    ELSE 0
  END
)
UPDATE public.incidents i
SET status = CASE
      WHEN r.minimum_status IN ('resolved'::public.incident_status, 'in_qa'::public.incident_status)
        THEN 'resolved'::public.incident_status
      ELSE r.minimum_status
    END,
    status_environment = CASE
      WHEN r.minimum_status IN ('resolved'::public.incident_status, 'in_qa'::public.incident_status)
        THEN (
          SELECT COALESCE(ia.status_environment, 'PRO')
          FROM public.incident_assignments ia
          WHERE ia.incident_id = r.incident_id
            AND ia.status IN ('resolved'::public.incident_status, 'in_qa'::public.incident_status)
          ORDER BY CASE COALESCE(ia.status_environment, 'PRO')
            WHEN 'DEV' THEN 0
            WHEN 'PRE' THEN 1
            WHEN 'PRO' THEN 2
            ELSE 2
          END
          LIMIT 1
        )
      ELSE NULL
    END,
    updated_at = now()
FROM ranked_assignments r
WHERE i.id = r.incident_id;
