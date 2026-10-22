-- Schedule automatic daily task persistence at 6:00 AM on weekdays (Mon-Fri)
-- This migration creates a cron job that calls the persist_previous_day_tasks RPC function

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that will be called by the cron job
CREATE OR REPLACE FUNCTION public.cron_persist_daily_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the persist_previous_day_tasks function for all active projects
  PERFORM persist_previous_day_tasks(p_force := false);
  
  -- Log the execution
  INSERT INTO public.activity_log (
    type,
    description,
    project_id,
    created_by
  ) SELECT
    'system_auto_persist',
    'Automatic daily task persistence executed at 6:00 AM',
    DISTINCT(project_id),
    '00000000-0000-0000-0000-000000000000'::uuid
  FROM public.projects;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  RAISE WARNING 'Error in cron_persist_daily_tasks: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run at 6:00 AM on weekdays (Mon-Fri)
-- The cron expression is: minute hour day month day_of_week
-- 0 6 * * 1-5 means: at 6:00 AM, every day, every month, Monday through Friday
SELECT cron.schedule(
  'auto-persist-daily-tasks-6am-weekdays',
  '0 6 * * 1-5',
  'SELECT public.cron_persist_daily_tasks()'
);

-- Add a comment explaining the schedule
COMMENT ON FUNCTION public.cron_persist_daily_tasks() IS
'Automatically persist previous day tasks at 6:00 AM on weekdays (Monday-Friday).
This function is called by pg_cron scheduler and executes the persist_previous_day_tasks RPC.';
