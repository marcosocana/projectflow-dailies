-- Restore the tasks persisted from 2026-05-25 into 2026-05-26.
-- This recreates missing daily_tasks links only, preserving the source order.

WITH source_projects AS (
  SELECT DISTINCT
    d.project_id
  FROM public.dailies d
  JOIN public.daily_tasks dt
    ON dt.daily_id = d.id
  WHERE d.date = DATE '2026-05-25'
),
created_targets AS (
  INSERT INTO public.dailies (project_id, date, content)
  SELECT
    source_projects.project_id,
    DATE '2026-05-26',
    '{}'::jsonb
  FROM source_projects
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.dailies existing
    WHERE existing.project_id = source_projects.project_id
      AND existing.date = DATE '2026-05-26'
  )
  RETURNING id, project_id
),
daily_pairs AS (
  SELECT
    source_daily.project_id,
    source_daily.id AS source_daily_id,
    target_daily.id AS target_daily_id
  FROM public.dailies source_daily
  JOIN public.dailies target_daily
    ON target_daily.project_id = source_daily.project_id
   AND target_daily.date = DATE '2026-05-26'
  WHERE source_daily.date = DATE '2026-05-25'
),
target_max_order AS (
  SELECT
    daily_pairs.target_daily_id,
    COALESCE(MAX(existing.order_position), -1) AS max_order_position
  FROM daily_pairs
  LEFT JOIN public.daily_tasks existing
    ON existing.daily_id = daily_pairs.target_daily_id
  GROUP BY daily_pairs.target_daily_id
),
missing_source_tasks AS (
  SELECT
    daily_pairs.target_daily_id,
    source_tasks.task_id,
    target_max_order.max_order_position,
    ROW_NUMBER() OVER (
      PARTITION BY daily_pairs.target_daily_id
      ORDER BY COALESCE(source_tasks.order_position, 999999), tasks.created_at, tasks.id
    ) AS restore_order
  FROM daily_pairs
  JOIN target_max_order
    ON target_max_order.target_daily_id = daily_pairs.target_daily_id
  JOIN public.daily_tasks source_tasks
    ON source_tasks.daily_id = daily_pairs.source_daily_id
  JOIN public.tasks
    ON tasks.id = source_tasks.task_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks existing
    WHERE existing.daily_id = daily_pairs.target_daily_id
      AND existing.task_id = source_tasks.task_id
  )
)
INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
SELECT
  target_daily_id,
  task_id,
  max_order_position + restore_order
FROM missing_source_tasks;
