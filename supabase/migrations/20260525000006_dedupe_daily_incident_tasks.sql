WITH ranked_daily_tasks AS (
  SELECT
    dt.task_id,
    ROW_NUMBER() OVER (
      PARTITION BY dt.daily_id, t.incident_id, COALESCE(t.person_id, t.assigned_to)
      ORDER BY t.created_at ASC NULLS LAST, t.id ASC
    ) AS duplicate_rank
  FROM public.daily_tasks dt
  JOIN public.tasks t ON t.id = dt.task_id
  WHERE t.incident_id IS NOT NULL
    AND COALESCE(t.person_id, t.assigned_to) IS NOT NULL
),
duplicate_tasks AS (
  SELECT DISTINCT task_id
  FROM ranked_daily_tasks
  WHERE duplicate_rank > 1
),
deleted_daily_links AS (
  DELETE FROM public.daily_tasks dt
  USING duplicate_tasks d
  WHERE dt.task_id = d.task_id
  RETURNING dt.task_id
)
DELETE FROM public.tasks t
USING duplicate_tasks d
WHERE t.id = d.task_id;
