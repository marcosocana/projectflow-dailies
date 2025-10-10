-- Updated function to sync incident status based on assignments
-- Priority: if any assignment is 'in_progress', the incident becomes 'in_progress'
-- Otherwise: if all assignments have the same status, use that status
CREATE OR REPLACE FUNCTION sync_incident_status_from_assignments()
RETURNS TRIGGER AS $$
DECLARE
  total_assignments INTEGER;
  in_progress_count INTEGER;
  distinct_statuses INTEGER;
  common_status incident_status;
  target_incident_id uuid;
BEGIN
  -- Get the incident_id (handle INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    target_incident_id := OLD.incident_id;
  ELSE
    target_incident_id := NEW.incident_id;
  END IF;

  -- Count total assignments for this incident
  SELECT COUNT(*) INTO total_assignments
  FROM incident_assignments
  WHERE incident_id = target_incident_id;

  -- Only process if there are multiple assignments
  IF total_assignments > 1 THEN
    -- Check if any assignment has 'in_progress' status
    SELECT COUNT(*) INTO in_progress_count
    FROM incident_assignments
    WHERE incident_id = target_incident_id AND status = 'in_progress';

    -- If at least one is 'in_progress', set incident to 'in_progress'
    IF in_progress_count > 0 THEN
      UPDATE incidents
      SET status = 'in_progress', updated_at = now()
      WHERE id = target_incident_id;
    ELSE
      -- Otherwise, check if all assignments have the same status
      SELECT COUNT(DISTINCT status) INTO distinct_statuses
      FROM incident_assignments
      WHERE incident_id = target_incident_id;

      -- If all assignments have the same status, update the incident
      IF distinct_statuses = 1 THEN
        SELECT status INTO common_status
        FROM incident_assignments
        WHERE incident_id = target_incident_id
        LIMIT 1;

        UPDATE incidents
        SET status = common_status, updated_at = now()
        WHERE id = target_incident_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;