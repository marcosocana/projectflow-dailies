UPDATE public.incidents
SET environment = NULL
WHERE environment IS NOT NULL
  AND environment NOT IN ('DEV', 'PRE', 'PRO');

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
