-- Function to sync incident status based on assignments
CREATE OR REPLACE FUNCTION sync_incident_status_from_assignments()
RETURNS TRIGGER AS $$
DECLARE
  total_assignments INTEGER;
  distinct_statuses INTEGER;
  common_status incident_status;
BEGIN
  -- Get the incident_id (handle INSERT, UPDATE, DELETE)
  DECLARE
    target_incident_id uuid;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      target_incident_id := OLD.incident_id;
    ELSE
      target_incident_id := NEW.incident_id;
    END IF;

    -- Count total assignments for this incident
    SELECT COUNT(*) INTO total_assignments
    FROM incident_assignments
    WHERE incident_id = target_incident_id;

    -- If there are multiple assignments, check if they all have the same status
    IF total_assignments > 1 THEN
      -- Count distinct statuses
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
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on incident_assignments
DROP TRIGGER IF EXISTS trigger_sync_incident_status ON incident_assignments;
CREATE TRIGGER trigger_sync_incident_status
AFTER INSERT OR UPDATE OR DELETE ON incident_assignments
FOR EACH ROW
EXECUTE FUNCTION sync_incident_status_from_assignments();