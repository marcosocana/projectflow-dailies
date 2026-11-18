-- Las tareas internas (marca [id:int], se muestran como INT123) no las ve el cliente.
-- Equipo y admins no cambian. Un usuario con rol 'team' en un proyecto sigue viéndolas
-- en ese proyecto aunque sea cliente en otro.

CREATE OR REPLACE FUNCTION public.can_access_incident(
  _project_id UUID,
  _category TEXT,
  _additional_comments TEXT,
  _epic TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.current_user_is_client()
    OR EXISTS (
      SELECT 1 FROM public.project_access pa
      WHERE pa.user_id = auth.uid()
        AND pa.project_id = _project_id
        AND (
          pa.role = 'team'
          OR (
            COALESCE(_additional_comments, '') NOT LIKE '%[id:int]%'
            AND (COALESCE(cardinality(pa.allowed_categories), 0) = 0
              OR public.incident_effective_category(_category, _additional_comments) = ANY (pa.allowed_categories))
            AND (COALESCE(cardinality(pa.allowed_epics), 0) = 0
              OR _epic = ANY (pa.allowed_epics))
          )
        )
    );
$$;

-- tasks (seguimiento diario) contiene títulos de tareas: el cliente solo ve las
-- vinculadas a una tarea a la que tiene acceso, así no se filtran las internas.
DROP POLICY IF EXISTS "Client project scope" ON public.tasks;
CREATE POLICY "Client project scope" ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT public.current_user_is_client()
  OR (incident_id IS NOT NULL AND public.can_access_incident_id(incident_id))
)
WITH CHECK (
  NOT public.current_user_is_client()
  OR (incident_id IS NOT NULL AND public.can_access_incident_id(incident_id))
);
