ALTER TABLE public.incident_activity_logs
  ALTER COLUMN incident_id DROP NOT NULL;

ALTER TABLE public.incident_activity_logs
  DROP CONSTRAINT IF EXISTS incident_activity_logs_incident_id_fkey;

ALTER TABLE public.incident_activity_logs
  ADD CONSTRAINT incident_activity_logs_incident_id_fkey
  FOREIGN KEY (incident_id)
  REFERENCES public.incidents(id)
  ON DELETE SET NULL;
