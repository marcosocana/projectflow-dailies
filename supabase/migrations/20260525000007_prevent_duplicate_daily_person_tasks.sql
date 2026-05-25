CREATE UNIQUE INDEX IF NOT EXISTS tasks_unique_daily_incident_person
ON public.tasks (
  daily_id,
  incident_id,
  COALESCE(person_id, assigned_to)
)
WHERE daily_id IS NOT NULL
  AND incident_id IS NOT NULL
  AND COALESCE(person_id, assigned_to) IS NOT NULL;
