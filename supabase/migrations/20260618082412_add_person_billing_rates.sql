CREATE TABLE IF NOT EXISTS public.person_billing_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  year INTEGER,
  month INTEGER CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  cost_rate NUMERIC(10, 2),
  sale_rate NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT person_billing_rates_global_or_month CHECK (
    (year IS NULL AND month IS NULL) OR (year IS NOT NULL AND month IS NOT NULL)
  ),
  UNIQUE(project_id, person_id, year, month)
);

ALTER TABLE public.person_billing_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view person billing rates"
  ON public.person_billing_rates FOR SELECT
  USING (true);

CREATE POLICY "Users can create person billing rates"
  ON public.person_billing_rates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update person billing rates"
  ON public.person_billing_rates FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete person billing rates"
  ON public.person_billing_rates FOR DELETE
  USING (true);

DROP TRIGGER IF EXISTS update_person_billing_rates_updated_at ON public.person_billing_rates;
CREATE TRIGGER update_person_billing_rates_updated_at
  BEFORE UPDATE ON public.person_billing_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
