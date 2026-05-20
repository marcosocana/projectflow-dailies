DROP POLICY IF EXISTS "Project members can insert incident activity logs" ON public.incident_activity_logs;

CREATE POLICY "Project members can insert incident activity logs"
ON public.incident_activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.project_access pa
    WHERE pa.project_id = incident_activity_logs.project_id
      AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);
