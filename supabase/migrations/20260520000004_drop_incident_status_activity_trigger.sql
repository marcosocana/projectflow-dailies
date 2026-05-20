DROP TRIGGER IF EXISTS incident_status_activity_log ON public.incidents;
DROP FUNCTION IF EXISTS public.log_incident_status_change();
