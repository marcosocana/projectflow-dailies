-- Materialize Home assignments as daily tasks for today.
-- Every incident assigned to a team member, either through incident_assignments
-- or incidents.assigned_to, gets one visible daily task for that person.

WITH today_dailies AS (
  SELECT
    project_id,
    id AS daily_id
  FROM public.dailies
  WHERE date = timezone('Europe/Madrid', now())::date
),
assignment_sources AS (
  SELECT DISTINCT ON (i.id, ia.assigned_to)
    td.daily_id,
    i.project_id,
    i.id AS incident_id,
    ia.assigned_to AS person_id,
    i.name,
    i.description,
    i.incident_number,
    i.additional_comments,
    ia.status,
    ia.status_environment
  FROM today_dailies td
  JOIN public.incidents i
    ON i.project_id = td.project_id
  JOIN public.incident_assignments ia
    ON ia.incident_id = i.id
  JOIN public.people p
    ON p.project_id = i.project_id
   AND p.id = ia.assigned_to
  WHERE ia.assigned_to IS NOT NULL
  ORDER BY i.id, ia.assigned_to, ia.created_at
),
direct_sources AS (
  SELECT
    td.daily_id,
    i.project_id,
    i.id AS incident_id,
    i.assigned_to AS person_id,
    i.name,
    i.description,
    i.incident_number,
    i.additional_comments,
    i.status,
    i.status_environment
  FROM today_dailies td
  JOIN public.incidents i
    ON i.project_id = td.project_id
  JOIN public.people p
    ON p.project_id = i.project_id
   AND p.id = i.assigned_to
  WHERE i.assigned_to IS NOT NULL
),
desired_sources AS (
  SELECT * FROM assignment_sources
  UNION
  SELECT direct_sources.*
  FROM direct_sources
  WHERE NOT EXISTS (
    SELECT 1
    FROM assignment_sources
    WHERE assignment_sources.incident_id = direct_sources.incident_id
      AND assignment_sources.person_id = direct_sources.person_id
  )
),
inserted_tasks AS (
  INSERT INTO public.tasks (
    title,
    description,
    project_id,
    daily_id,
    incident_id,
    person_id,
    assigned_to,
    status,
    status_environment,
    is_auto_linked,
    related_ticket
  )
  SELECT
    desired_sources.name,
    desired_sources.description,
    desired_sources.project_id,
    desired_sources.daily_id,
    desired_sources.incident_id,
    desired_sources.person_id,
    desired_sources.person_id,
    CASE
      WHEN desired_sources.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
        THEN 'resolved'::public.task_status
      WHEN desired_sources.status = 'blocked'::public.incident_status
        THEN 'blocked'::public.task_status
      WHEN desired_sources.status = 'in_progress'::public.incident_status
        THEN 'in_progress'::public.task_status
      ELSE 'pending'::public.task_status
    END,
    CASE
      WHEN desired_sources.status IN ('resolved'::public.incident_status, 'closed'::public.incident_status, 'in_qa'::public.incident_status)
        THEN COALESCE(desired_sources.status_environment, 'PRO')
      ELSE NULL
    END,
    true,
    CASE
      WHEN COALESCE(desired_sources.additional_comments, '') LIKE '%[id:int]%'
        THEN 'INT' || desired_sources.incident_number::text
      ELSE desired_sources.incident_number::text
    END
  FROM desired_sources
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.tasks existing
    WHERE existing.incident_id = desired_sources.incident_id
      AND COALESCE(existing.person_id, existing.assigned_to) = desired_sources.person_id
  )
  RETURNING id, daily_id
),
existing_desired_tasks AS (
  SELECT
    desired_sources.daily_id,
    tasks.id AS task_id
  FROM desired_sources
  JOIN public.tasks
    ON tasks.incident_id = desired_sources.incident_id
   AND COALESCE(tasks.person_id, tasks.assigned_to) = desired_sources.person_id
  UNION
  SELECT
    inserted_tasks.daily_id,
    inserted_tasks.id AS task_id
  FROM inserted_tasks
),
missing_links AS (
  SELECT
    existing_desired_tasks.daily_id,
    existing_desired_tasks.task_id,
    ROW_NUMBER() OVER (
      PARTITION BY existing_desired_tasks.daily_id
      ORDER BY existing_desired_tasks.task_id
    ) AS restore_order
  FROM existing_desired_tasks
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks existing
    WHERE existing.daily_id = existing_desired_tasks.daily_id
      AND existing.task_id = existing_desired_tasks.task_id
  )
),
max_orders AS (
  SELECT
    missing_links.daily_id,
    COALESCE(MAX(daily_tasks.order_position), -1) AS max_order_position
  FROM missing_links
  LEFT JOIN public.daily_tasks
    ON daily_tasks.daily_id = missing_links.daily_id
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
