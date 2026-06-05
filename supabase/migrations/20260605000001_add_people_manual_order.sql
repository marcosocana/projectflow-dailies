ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS order_position INTEGER;

WITH ranked_people AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY created_at ASC, name ASC, id ASC
    ) - 1 AS position
  FROM public.people
)
UPDATE public.people
SET order_position = ranked_people.position
FROM ranked_people
WHERE people.id = ranked_people.id
  AND people.order_position IS NULL;

CREATE INDEX IF NOT EXISTS idx_people_project_order
ON public.people (project_id, order_position, created_at);
