CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, person_id, entry_date)
);

ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project time entries"
  ON public.project_time_entries FOR SELECT
  USING (true);

CREATE POLICY "Users can create project time entries"
  ON public.project_time_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update project time entries"
  ON public.project_time_entries FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete project time entries"
  ON public.project_time_entries FOR DELETE
  USING (true);

DROP TRIGGER IF EXISTS update_project_time_entries_updated_at ON public.project_time_entries;
CREATE TRIGGER update_project_time_entries_updated_at
  BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
