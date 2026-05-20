ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS environment TEXT;

ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_environment_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_environment_check
CHECK (
  environment IS NULL OR environment IN ('DEV', 'PRE', 'PRO')
);
