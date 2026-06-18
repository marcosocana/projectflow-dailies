ALTER TABLE public.project_time_entries
ADD COLUMN IF NOT EXISTS absence_type TEXT;

UPDATE public.project_time_entries
SET absence_type = 'holiday'
WHERE is_holiday = true
  AND absence_type IS NULL;

ALTER TABLE public.project_time_entries
DROP CONSTRAINT IF EXISTS project_time_entries_absence_type_check;

ALTER TABLE public.project_time_entries
ADD CONSTRAINT project_time_entries_absence_type_check
CHECK (absence_type IS NULL OR absence_type IN ('holiday', 'vacation', 'sick_leave'));
