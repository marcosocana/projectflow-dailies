-- Create enum for task status
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column to tasks with default 'pending'
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'pending';

-- Backfill any existing nulls just in case (shouldn't be needed if NOT NULL)
UPDATE public.tasks SET status = 'pending' WHERE status IS NULL;