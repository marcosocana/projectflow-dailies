-- Disable the automatic 06:00 Europe/Madrid daily task persistence.
-- Manual persistence remains available because the persist_previous_day_tasks
-- function is intentionally left in place.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

SELECT cron.unschedule('persist-daily-tasks-6am') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-6am'
);

SELECT cron.unschedule('persist-daily-tasks-madrid-6am-weekdays') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'persist-daily-tasks-madrid-6am-weekdays'
);
