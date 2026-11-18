-- Rol "Cliente" por proyecto.
--
-- project_access.role = 'team' (por defecto, comportamiento actual) o 'client'.
-- Un cliente solo ve las tareas de los proyectos donde tiene fila de acceso y
-- que cumplan sus filtros (allowed_categories / allowed_epics; NULL o vacío = todas).
-- Puede crear, editar y borrar tareas dentro de ese ámbito.
--
-- Los usuarios que no son cliente en ningún proyecto (equipo y admins) mantienen
-- exactamente el mismo acceso que antes: todas las funciones devuelven true para ellos.

ALTER TABLE public.project_access
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS allowed_categories TEXT[],
  ADD COLUMN IF NOT EXISTS allowed_epics TEXT[];

DO $$ BEGIN
  ALTER TABLE public.project_access
    ADD CONSTRAINT project_access_role_check CHECK (role IN ('team', 'client'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.project_access
    ADD CONSTRAINT project_access_allowed_categories_check
    CHECK (allowed_categories IS NULL OR allowed_categories <@ ARRAY['incident', 'improvement', 'corrective_improvement']::TEXT[]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

-- Misma regla que getEffectiveCategory() del frontend.
CREATE OR REPLACE FUNCTION public.incident_effective_category(_category TEXT, _additional_comments TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _category = 'corrective_improvement'
      OR COALESCE(_additional_comments, '') LIKE '%[tipo:mejora_correctiva]%' THEN 'corrective_improvement'
    WHEN _category = 'improvement' THEN 'improvement'
    ELSE 'incident'
  END;
$$;

-- true si el usuario actual es cliente en algún proyecto (y no es admin).
CREATE OR REPLACE FUNCTION public.current_user_is_client()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.current_user_is_admin()
    AND EXISTS (
      SELECT 1 FROM public.project_access pa
      WHERE pa.user_id = auth.uid() AND pa.role = 'client'
    );
$$;

-- Para clientes: solo proyectos con fila de acceso. Resto de usuarios: sin cambios.
CREATE OR REPLACE FUNCTION public.can_access_project_data(_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.current_user_is_client()
    OR EXISTS (
      SELECT 1 FROM public.project_access pa
      WHERE pa.user_id = auth.uid() AND pa.project_id = _project_id
    );
$$;

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
            (COALESCE(cardinality(pa.allowed_categories), 0) = 0
              OR public.incident_effective_category(_category, _additional_comments) = ANY (pa.allowed_categories))
            AND (COALESCE(cardinality(pa.allowed_epics), 0) = 0
              OR _epic = ANY (pa.allowed_epics))
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_incident_id(_incident_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.current_user_is_client()
    OR EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = _incident_id
        AND public.can_access_incident(i.project_id, i.category::TEXT, i.additional_comments, i.epic)
    );
$$;

GRANT EXECUTE ON FUNCTION public.incident_effective_category(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_client() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_incident(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_incident_id(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- incidents: sustituye las políticas abiertas (USING true)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view incidents from all projects" ON public.incidents;
DROP POLICY IF EXISTS "Users can create incidents in any project" ON public.incidents;
DROP POLICY IF EXISTS "Users can update any incident" ON public.incidents;
DROP POLICY IF EXISTS "Users can delete any incident" ON public.incidents;

-- Re-ejecutable: elimina también las políticas nuevas si ya existían.
DROP POLICY IF EXISTS "Scoped incident read" ON public.incidents;
DROP POLICY IF EXISTS "Scoped incident insert" ON public.incidents;
DROP POLICY IF EXISTS "Scoped incident update" ON public.incidents;
DROP POLICY IF EXISTS "Scoped incident delete" ON public.incidents;

CREATE POLICY "Scoped incident read"
ON public.incidents FOR SELECT
TO authenticated
USING (public.can_access_incident(project_id, category::TEXT, additional_comments, epic));

CREATE POLICY "Scoped incident insert"
ON public.incidents FOR INSERT
TO authenticated
WITH CHECK (public.can_access_incident(project_id, category::TEXT, additional_comments, epic));

CREATE POLICY "Scoped incident update"
ON public.incidents FOR UPDATE
TO authenticated
USING (public.can_access_incident(project_id, category::TEXT, additional_comments, epic))
WITH CHECK (public.can_access_incident(project_id, category::TEXT, additional_comments, epic));

CREATE POLICY "Scoped incident delete"
ON public.incidents FOR DELETE
TO authenticated
USING (public.can_access_incident(project_id, category::TEXT, additional_comments, epic));

-- ---------------------------------------------------------------------------
-- Resto de tablas: políticas RESTRICTIVE (se suman con AND a las existentes),
-- así no se toca el acceso del equipo.
-- ---------------------------------------------------------------------------

-- Tablas que usa Home/Releases: el cliente solo ve las de sus proyectos.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['people', 'tasks', 'releases', 'incident_activity_logs'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Client project scope" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Client project scope" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.can_access_project_data(project_id))
         WITH CHECK (public.can_access_project_data(project_id))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Hijas de una tarea: el cliente solo ve las de tareas a las que tiene acceso.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['incident_assignments', 'incident_comments'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Client incident scope" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Client incident scope" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.can_access_incident_id(incident_id))
         WITH CHECK (public.can_access_incident_id(incident_id))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Módulos que el cliente no usa: sin acceso.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'dailies', 'daily_tasks', 'interesting_links', 'monthly_metrics',
    'project_time_entries', 'project_time_month_locks', 'project_time_month_person_metrics',
    'project_cost_tags', 'person_billing_rates', 'repository_files', 'shared_notes',
    'shared_notes_history', 'task_comments', 'vacations', 'user_permissions'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "No client access" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "No client access" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (NOT public.current_user_is_client())
         WITH CHECK (NOT public.current_user_is_client())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- project_access: el cliente puede leer sus filas pero no crear, cambiar ni borrar
-- accesos (si no, podría darse rol de equipo o quitarse los filtros).
DROP POLICY IF EXISTS "Clients cannot insert project access" ON public.project_access;
DROP POLICY IF EXISTS "Clients cannot update project access" ON public.project_access;
DROP POLICY IF EXISTS "Clients cannot delete project access" ON public.project_access;

CREATE POLICY "Clients cannot insert project access"
ON public.project_access AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.current_user_is_client());

CREATE POLICY "Clients cannot update project access"
ON public.project_access AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.current_user_is_client());

CREATE POLICY "Clients cannot delete project access"
ON public.project_access AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT public.current_user_is_client());

-- Solo un admin puede asignar el rol cliente o cambiar sus filtros (el alta
-- de usuarios desde el módulo Usuarios sigue creando filas 'team').
CREATE OR REPLACE FUNCTION public.protect_project_access_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_admin() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'team' OR NEW.allowed_categories IS NOT NULL OR NEW.allowed_epics IS NOT NULL THEN
      RAISE EXCEPTION 'Solo un administrador puede asignar el rol Cliente';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.allowed_categories IS DISTINCT FROM OLD.allowed_categories
     OR NEW.allowed_epics IS DISTINCT FROM OLD.allowed_epics THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el rol o los filtros de acceso';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_project_access_role ON public.project_access;
CREATE TRIGGER protect_project_access_role
BEFORE INSERT OR UPDATE ON public.project_access
FOR EACH ROW
EXECUTE FUNCTION public.protect_project_access_role();
