-- A newly assigned person must see the incident in today's daily regardless
-- of which Home client version created the assignment. This does not carry
-- the task to future days; that remains controlled by manual persistence.

CREATE OR REPLACE FUNCTION public.materialize_new_assignment_in_today_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.incident_id IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.ensure_home_assignments_in_daily(
      NEW.incident_id,
      ARRAY[NEW.assigned_to]::UUID[]
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materialize_new_assignment_in_today_daily
ON public.incident_assignments;

CREATE TRIGGER materialize_new_assignment_in_today_daily
AFTER INSERT OR UPDATE OF assigned_to
ON public.incident_assignments
FOR EACH ROW
WHEN (NEW.assigned_to IS NOT NULL)
EXECUTE FUNCTION public.materialize_new_assignment_in_today_daily();
