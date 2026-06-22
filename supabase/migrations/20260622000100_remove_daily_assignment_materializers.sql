-- Assignments must not materialize or link daily tasks automatically.
-- Existing linked task statuses are still synchronized by the application.

DROP TRIGGER IF EXISTS sync_daily_tasks_after_assignment_change ON public.incident_assignments;
DROP TRIGGER IF EXISTS sync_daily_tasks_after_incident_assignee_change ON public.incidents;

DROP FUNCTION IF EXISTS public.sync_daily_tasks_after_assignment_change();
DROP FUNCTION IF EXISTS public.sync_daily_tasks_after_incident_assignee_change();
DROP FUNCTION IF EXISTS public.sync_daily_tasks_for_incident_assignments(uuid);
