ALTER TABLE public.project_time_month_person_metrics
ADD COLUMN IF NOT EXISTS sold_hours NUMERIC CHECK (sold_hours IS NULL OR sold_hours >= 0);
