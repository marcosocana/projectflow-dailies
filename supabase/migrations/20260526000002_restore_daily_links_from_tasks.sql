-- Restore daily task links from the canonical tasks.daily_id field.
-- Safe to rerun: it only inserts missing daily_tasks rows.

WITH missing_links AS (
  SELECT
    tasks.daily_id,
    tasks.id AS task_id,
    ROW_NUMBER() OVER (
      PARTITION BY tasks.daily_id
      ORDER BY tasks.created_at, tasks.id
    ) AS restore_order
  FROM public.tasks
  JOIN public.dailies
    ON dailies.id = tasks.daily_id
  WHERE tasks.daily_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks existing
      WHERE existing.daily_id = tasks.daily_id
        AND existing.task_id = tasks.id
    )
),
max_orders AS (
  SELECT
    missing_links.daily_id,
    COALESCE(MAX(existing.order_position), -1) AS max_order_position
  FROM missing_links
  LEFT JOIN public.daily_tasks existing
    ON existing.daily_id = missing_links.daily_id
  GROUP BY missing_links.daily_id
)
INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
SELECT
  missing_links.daily_id,
  missing_links.task_id,
  max_orders.max_order_position + missing_links.restore_order
FROM missing_links
JOIN max_orders
  ON max_orders.daily_id = missing_links.daily_id;
