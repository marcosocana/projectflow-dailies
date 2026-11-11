-- An ID only has to be unique within its category (incident, improvement,
-- corrective improvement). Corrective improvements are stored as
-- category = 'improvement' plus the [tipo:mejora_correctiva] marker, so the
-- effective category is computed in the index expression.
-- The index name keeps "incident_number" because the client detects duplicate
-- IDs by looking for it in the 23505 error message.
CREATE UNIQUE INDEX IF NOT EXISTS incidents_project_category_incident_number_key
ON public.incidents (
  project_id,
  (
    CASE
      WHEN category = 'incident'::public.incident_category THEN 0
      WHEN additional_comments LIKE '%[tipo:mejora_correctiva]%' THEN 2
      ELSE 1
    END
  ),
  incident_number
);

ALTER TABLE public.incidents
DROP CONSTRAINT IF EXISTS incidents_project_id_incident_number_key;
