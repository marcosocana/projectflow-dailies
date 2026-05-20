ALTER TABLE public.releases
ADD COLUMN IF NOT EXISTS included_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.releases.included_tasks IS 'Tasks included in the release, stored as ID/title references for existing or manual tasks.';
