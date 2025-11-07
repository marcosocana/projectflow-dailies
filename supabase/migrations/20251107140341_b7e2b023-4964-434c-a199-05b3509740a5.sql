-- Add new status value to task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'resolved_yesterday';