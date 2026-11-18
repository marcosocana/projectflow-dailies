-- Rol Cliente: no puede ver nombres de personas, solo su rol.
--
-- - people: sin acceso directo para clientes (contiene nombre, color, user_id...).
-- - get_project_people_roles(): devuelve solo (person_id, role), sin nombre.
-- - incident_activity_logs: los clientes siguen pudiendo escribir (sus acciones
--   se registran) pero ya no leer (contiene actor_name y nombres de personas).
-- - incident_assignments: los clientes no pueden crear ni borrar asignaciones.
--   Sí pueden actualizarlas, porque cambiar el estado de una tarea con una sola
--   asignación sincroniza el estado de esa asignación.

-- people: de "alcance de proyecto" a "sin acceso".
DROP POLICY IF EXISTS "Client project scope" ON public.people;
DROP POLICY IF EXISTS "No client access" ON public.people;
CREATE POLICY "No client access" ON public.people AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.current_user_is_client())
WITH CHECK (NOT public.current_user_is_client());

-- incident_activity_logs: escritura permitida (alcance de proyecto), lectura no.
DROP POLICY IF EXISTS "No client read" ON public.incident_activity_logs;
CREATE POLICY "No client read" ON public.incident_activity_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.current_user_is_client());

-- incident_assignments: sin altas ni bajas por parte del cliente.
DROP POLICY IF EXISTS "Clients cannot insert assignments" ON public.incident_assignments;
DROP POLICY IF EXISTS "Clients cannot delete assignments" ON public.incident_assignments;
CREATE POLICY "Clients cannot insert assignments" ON public.incident_assignments AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.current_user_is_client());
CREATE POLICY "Clients cannot delete assignments" ON public.incident_assignments AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT public.current_user_is_client());

-- Rol de cada persona del proyecto, sin su nombre.
CREATE OR REPLACE FUNCTION public.get_project_people_roles(_project_id UUID)
RETURNS TABLE (person_id UUID, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.role
  FROM public.people p
  WHERE p.project_id = _project_id
    AND public.can_access_project_data(_project_id);
$$;

REVOKE ALL ON FUNCTION public.get_project_people_roles(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_people_roles(UUID) TO authenticated;
