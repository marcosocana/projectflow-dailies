-- Ensure every task assigned to a team member is visible in today's daily view.
-- Safe to rerun: only missing daily_tasks rows are inserted.

WITH today_dailies AS (
  SELECT
    project_id,
    id AS daily_id
  FROM public.dailies
  WHERE date = timezone('Europe/Madrid', now())::date
),
assigned_team_tasks AS (
  SELECT
    today_dailies.daily_id,
    tasks.id AS task_id,
    tasks.created_at
  FROM today_dailies
  JOIN public.tasks
    ON tasks.project_id = today_dailies.project_id
  JOIN public.people
    ON people.project_id = today_dailies.project_id
   AND people.id = COALESCE(tasks.person_id, tasks.assigned_to)
  WHERE COALESCE(tasks.person_id, tasks.assigned_to) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks existing
      WHERE existing.daily_id = today_dailies.daily_id
        AND existing.task_id = tasks.id
    )
),
max_orders AS (
  SELECT
    today_dailies.daily_id,
    COALESCE(MAX(daily_tasks.order_position), -1) AS max_order_position
  FROM today_dailies
  LEFT JOIN public.daily_tasks
    ON daily_tasks.daily_id = today_dailies.daily_id
  GROUP BY today_dailies.daily_id
),
ordered_missing AS (
  SELECT
    assigned_team_tasks.daily_id,
    assigned_team_tasks.task_id,
    max_orders.max_order_position,
    ROW_NUMBER() OVER (
      PARTITION BY assigned_team_tasks.daily_id
      ORDER BY assigned_team_tasks.created_at, assigned_team_tasks.task_id
    ) AS restore_order
  FROM assigned_team_tasks
  JOIN max_orders
    ON max_orders.daily_id = assigned_team_tasks.daily_id
)
INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
SELECT
  daily_id,
  task_id,
  max_order_position + restore_order
FROM ordered_missing;
