DELETE FROM public.incident_activity_logs
WHERE created_at >= TIMESTAMPTZ '2026-05-18 00:00:00+02'
  AND created_at < TIMESTAMPTZ '2026-05-19 00:00:00+02';
