-- Add user_email to incident_comments to store commenter email
ALTER TABLE public.incident_comments
ADD COLUMN IF NOT EXISTS user_email text;

-- Create mapping table for tasks across dailies to persist same task id
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  daily_id uuid NOT NULL REFERENCES public.dailies(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (daily_id, task_id)
);

-- Enable RLS
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- Policies: mimic current permissive policies used elsewhere
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_tasks' AND policyname = 'Users can view daily tasks' ) THEN
    CREATE POLICY "Users can view daily tasks" ON public.daily_tasks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_tasks' AND policyname = 'Users can insert daily tasks' ) THEN
    CREATE POLICY "Users can insert daily tasks" ON public.daily_tasks FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_tasks' AND policyname = 'Users can delete daily tasks' ) THEN
    CREATE POLICY "Users can delete daily tasks" ON public.daily_tasks FOR DELETE USING (true);
  END IF;
END $$;

-- Backfill existing mappings from tasks.daily_id
INSERT INTO public.daily_tasks (daily_id, task_id)
SELECT DISTINCT daily_id, id
FROM public.tasks
WHERE daily_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Helpful index for reverse lookups
CREATE INDEX IF NOT EXISTS idx_daily_tasks_task_id ON public.daily_tasks (task_id);
