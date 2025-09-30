-- Add order_position column to daily_tasks table
ALTER TABLE daily_tasks 
ADD COLUMN order_position INTEGER DEFAULT 0;

-- Update existing records with sequential order based on task creation date
WITH ranked_tasks AS (
  SELECT 
    daily_id,
    task_id,
    ROW_NUMBER() OVER (PARTITION BY daily_id ORDER BY created_at) - 1 AS new_position
  FROM daily_tasks
)
UPDATE daily_tasks dt
SET order_position = rt.new_position
FROM ranked_tasks rt
WHERE dt.daily_id = rt.daily_id AND dt.task_id = rt.task_id;