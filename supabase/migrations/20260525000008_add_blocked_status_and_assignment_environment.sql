ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';

ALTER TABLE public.incident_assignments
ADD COLUMN IF NOT EXISTS environment TEXT;

ALTER TABLE public.incident_assignments
DROP CONSTRAINT IF EXISTS incident_assignments_environment_check;

ALTER TABLE public.incident_assignments
ADD CONSTRAINT incident_assignments_environment_check
CHECK (
  environment IS NULL OR environment IN ('DEV', 'PRE', 'PRO')
);

UPDATE public.incidents
SET environment = 'PRE',
    status = 'resolved'::public.incident_status
WHERE status = 'in_qa'::public.incident_status;

UPDATE public.incidents
SET environment = 'PRO',
    status = 'resolved'::public.incident_status
WHERE status = 'closed'::public.incident_status;

UPDATE public.incidents
SET environment = COALESCE(NULLIF(environment, ''), 'PRO')
WHERE status = 'resolved'::public.incident_status;

UPDATE public.incident_assignments
SET environment = 'PRE',
    status = 'resolved'::public.incident_status
WHERE status = 'in_qa'::public.incident_status;

UPDATE public.incident_assignments
SET environment = 'PRO',
    status = 'resolved'::public.incident_status
WHERE status = 'closed'::public.incident_status;

UPDATE public.incident_assignments ia
SET environment = COALESCE(NULLIF(ia.environment, ''), NULLIF(i.environment, ''), 'PRO')
FROM public.incidents i
WHERE ia.incident_id = i.id
  AND ia.status = 'resolved'::public.incident_status;

UPDATE public.tasks
SET environment = 'PRE'
WHERE status = 'resolved'::public.task_status
  AND environment = 'QA';

UPDATE public.tasks
SET environment = COALESCE(NULLIF(environment, ''), 'PRO')
WHERE status = 'resolved'::public.task_status;
