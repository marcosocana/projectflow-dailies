ALTER TABLE public.project_time_month_person_metrics
ADD COLUMN IF NOT EXISTS cost_tag TEXT;
