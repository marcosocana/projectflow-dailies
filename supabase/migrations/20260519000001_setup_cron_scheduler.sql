-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

-- Grant usage on pg_cron to service role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO postgres;

-- Schedule the persist_previous_day_tasks function to run at 6:00 AM UTC every day
-- Remove any existing job with the same name first
SELECT cron.unschedule('persist-daily-tasks-6am') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-6am'
);

-- Create the scheduled job
SELECT cron.schedule(
  'persist-daily-tasks-6am',  -- Job name
  '0 6 * * *',                -- Cron expression: every day at 6:00 AM UTC
  'SELECT public.persist_previous_day_tasks();' -- Function to execute
);

-- Log the job creation
COMMENT ON TABLE cron.job IS 'pg_cron jobs - Job to persist previous day tasks at 6:00 AM UTC daily';
