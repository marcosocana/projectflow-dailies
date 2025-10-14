-- Create monthly_metrics table
CREATE TABLE public.monthly_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  person_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  value numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, person_id, year, month)
);

-- Enable RLS
ALTER TABLE public.monthly_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view monthly metrics from all projects"
  ON public.monthly_metrics FOR SELECT
  USING (true);

CREATE POLICY "Users can create monthly metrics in any project"
  ON public.monthly_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update monthly metrics in any project"
  ON public.monthly_metrics FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete monthly metrics from any project"
  ON public.monthly_metrics FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_monthly_metrics_updated_at
  BEFORE UPDATE ON public.monthly_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();