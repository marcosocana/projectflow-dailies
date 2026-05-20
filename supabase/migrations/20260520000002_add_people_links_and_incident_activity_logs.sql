ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.incident_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  incident_number INTEGER NOT NULL,
  incident_name TEXT NOT NULL,
  incident_category TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view incident activity logs" ON public.incident_activity_logs;
CREATE POLICY "Project members can view incident activity logs"
ON public.incident_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_access pa
    WHERE pa.project_id = incident_activity_logs.project_id
      AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);

CREATE INDEX IF NOT EXISTS incident_activity_logs_project_created_at_idx
  ON public.incident_activity_logs (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_incident_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name, p.color
    INTO actor_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.incident_activity_logs (
    project_id,
    incident_id,
    incident_number,
    incident_name,
    incident_category,
    from_status,
    to_status,
    actor_user_id,
    actor_name,
    actor_color
  ) VALUES (
    NEW.project_id,
    NEW.id,
    NEW.incident_number,
    NEW.name,
    NEW.category,
    OLD.status::text,
    NEW.status::text,
    auth.uid(),
    COALESCE(actor_profile.full_name, 'Usuario'),
    COALESCE(actor_profile.color, '#3B82F6')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incident_status_activity_log ON public.incidents;
CREATE TRIGGER incident_status_activity_log
AFTER UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.log_incident_status_change();
