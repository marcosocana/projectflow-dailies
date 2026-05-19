-- Create a function to persist tasks from previous day
CREATE OR REPLACE FUNCTION public.persist_previous_day_tasks()
RETURNS TABLE (
  project_id UUID,
  tasks_persisted INT
) AS $$
DECLARE
  v_yesterday DATE;
  v_today DATE;
  v_yesterday_daily_id UUID;
  v_today_daily_id UUID;
  v_task_record RECORD;
  v_new_task_id UUID;
  v_max_order_position INT;
  v_project_id UUID;
  v_rows_affected INT := 0;
BEGIN
  v_yesterday := CURRENT_DATE - INTERVAL '1 day';
  v_today := CURRENT_DATE;

  -- For each project with a daily record from yesterday
  FOR v_project_id IN
    SELECT DISTINCT d.project_id
    FROM public.dailies d
    WHERE d.date = v_yesterday
  LOOP
    -- Get the daily record for yesterday
    SELECT id INTO v_yesterday_daily_id
    FROM public.dailies
    WHERE project_id = v_project_id AND date = v_yesterday;

    -- Ensure today's daily exists
    SELECT id INTO v_today_daily_id
    FROM public.dailies
    WHERE project_id = v_project_id AND date = v_today;

    IF v_today_daily_id IS NULL THEN
      INSERT INTO public.dailies (project_id, date, content)
      VALUES (v_project_id, v_today, '{}')
      RETURNING id INTO v_today_daily_id;
    END IF;

    -- Get the max order position for today
    SELECT COALESCE(MAX(order_position), 0) INTO v_max_order_position
    FROM public.daily_tasks
    WHERE daily_id = v_today_daily_id;

    -- For each task from yesterday that is NOT "resolved_yesterday"
    FOR v_task_record IN
      SELECT dt.task_id, t.incident_id, t.person_id, t.title, t.description
      FROM public.daily_tasks dt
      JOIN public.tasks t ON dt.task_id = t.id
      WHERE dt.daily_id = v_yesterday_daily_id
        AND t.status != 'resolved_yesterday'
    LOOP
      -- Create a new task for today with the same details
      INSERT INTO public.tasks (
        project_id,
        daily_id,
        incident_id,
        person_id,
        title,
        description,
        status
      )
      VALUES (
        v_project_id,
        v_today_daily_id,
        v_task_record.incident_id,
        v_task_record.person_id,
        v_task_record.title,
        v_task_record.description,
        'pending'
      )
      RETURNING id INTO v_new_task_id;

      -- Link the new task to today's daily
      v_max_order_position := v_max_order_position + 1;
      INSERT INTO public.daily_tasks (daily_id, task_id, order_position)
      VALUES (v_today_daily_id, v_new_task_id, v_max_order_position);

      v_rows_affected := v_rows_affected + 1;
    END LOOP;

    -- Update resolved tasks from yesterday to "resolved_yesterday" status
    UPDATE public.tasks
    SET status = 'resolved_yesterday'
    WHERE daily_id = v_yesterday_daily_id
      AND status = 'resolved';

    RETURN QUERY SELECT v_project_id, v_rows_affected;
  END LOOP;

  -- If no projects found, return zero
  IF v_rows_affected = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_previous_day_tasks() TO service_role;
