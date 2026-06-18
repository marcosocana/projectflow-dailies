CREATE TABLE IF NOT EXISTS public.project_time_month_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, year, month)
);

ALTER TABLE public.project_time_month_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project time month locks"
  ON public.project_time_month_locks FOR SELECT
  USING (true);

CREATE POLICY "Admin can create project time month locks"
  ON public.project_time_month_locks FOR INSERT
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

CREATE POLICY "Admin can update project time month locks"
  ON public.project_time_month_locks FOR UPDATE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

CREATE POLICY "Admin can delete project time month locks"
  ON public.project_time_month_locks FOR DELETE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

DROP TRIGGER IF EXISTS update_project_time_month_locks_updated_at ON public.project_time_month_locks;
CREATE TRIGGER update_project_time_month_locks_updated_at
  BEFORE UPDATE ON public.project_time_month_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prevent_locked_project_time_entry_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_entry_date DATE;
  v_locked BOOLEAN;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  v_entry_date := COALESCE(NEW.entry_date, OLD.entry_date);

  SELECT locked INTO v_locked
  FROM public.project_time_month_locks
  WHERE project_id = v_project_id
    AND year = EXTRACT(YEAR FROM v_entry_date)::INTEGER
    AND month = EXTRACT(MONTH FROM v_entry_date)::INTEGER;

  IF COALESCE(v_locked, false)
     AND lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'mocanat@minsait.com' THEN
    RAISE EXCEPTION 'Project time entries are locked for this month';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_locked_project_time_entry_changes ON public.project_time_entries;
CREATE TRIGGER prevent_locked_project_time_entry_changes
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_project_time_entry_changes();
