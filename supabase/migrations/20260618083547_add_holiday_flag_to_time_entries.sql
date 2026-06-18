ALTER TABLE public.project_time_entries
ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT false;
