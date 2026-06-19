CREATE TABLE IF NOT EXISTS public.project_time_month_person_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  uncovered_hours NUMERIC NOT NULL DEFAULT 0 CHECK (uncovered_hours >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, person_id, year, month)
);

ALTER TABLE public.project_time_month_person_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view time month person metrics" ON public.project_time_month_person_metrics;
CREATE POLICY "Admins can view time month person metrics"
  ON public.project_time_month_person_metrics FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can create time month person metrics" ON public.project_time_month_person_metrics;
CREATE POLICY "Admins can create time month person metrics"
  ON public.project_time_month_person_metrics FOR INSERT
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can update time month person metrics" ON public.project_time_month_person_metrics;
CREATE POLICY "Admins can update time month person metrics"
  ON public.project_time_month_person_metrics FOR UPDATE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP POLICY IF EXISTS "Admins can delete time month person metrics" ON public.project_time_month_person_metrics;
CREATE POLICY "Admins can delete time month person metrics"
  ON public.project_time_month_person_metrics FOR DELETE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP TRIGGER IF EXISTS update_project_time_month_person_metrics_updated_at ON public.project_time_month_person_metrics;
CREATE TRIGGER update_project_time_month_person_metrics_updated_at
  BEFORE UPDATE ON public.project_time_month_person_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
