-- Un cliente con procesos limitados puede dar de alta un proceso NUEVO; al crearlo se
-- añade a su lista permitida. Solo procesos que no existen todavía en el proyecto: así
-- no se puede "crear" uno existente para ampliar el alcance.

-- Normaliza un proceso para compararlo (minúsculas, sin tildes ni espacios sobrantes).
CREATE OR REPLACE FUNCTION public.normalize_process_name(_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(lower(btrim(COALESCE(_value, ''))), 'áéíóúüñ', 'aeiouun');
$$;

CREATE OR REPLACE FUNCTION public.add_client_process(_project_id UUID, _process TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_process TEXT := btrim(COALESCE(_process, ''));
  v_role TEXT;
  v_allowed TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_process = '' OR length(v_process) > 80 THEN
    RAISE EXCEPTION 'Nombre de proceso no válido';
  END IF;

  SELECT pa.role, pa.allowed_epics INTO v_role, v_allowed
  FROM public.project_access pa
  WHERE pa.user_id = auth.uid() AND pa.project_id = _project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin acceso al proyecto';
  END IF;

  -- Equipo, o cliente con todos los procesos: no hay lista que ampliar.
  IF v_role <> 'client' OR COALESCE(cardinality(v_allowed), 0) = 0 THEN
    RETURN;
  END IF;

  IF v_process = ANY (v_allowed) THEN
    RETURN;
  END IF;

  -- Solo procesos nuevos.
  IF EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.project_id = _project_id
      AND public.normalize_process_name(i.epic) = public.normalize_process_name(v_process)
  ) OR EXISTS (
    SELECT 1
    FROM public.project_access pa2, unnest(pa2.allowed_epics) AS e
    WHERE pa2.project_id = _project_id
      AND public.normalize_process_name(e) = public.normalize_process_name(v_process)
  ) THEN
    RAISE EXCEPTION 'Ese proceso ya existe y no está en tu lista';
  END IF;

  -- El trigger de protección solo deja pasar este cambio concreto.
  PERFORM set_config('app.allow_client_process_add', 'on', true);

  UPDATE public.project_access
  SET allowed_epics = array_append(allowed_epics, v_process)
  WHERE user_id = auth.uid() AND project_id = _project_id;

  PERFORM set_config('app.allow_client_process_add', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.add_client_process(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_client_process(UUID, TEXT) TO authenticated;

-- Trigger de protección: permite el cambio de allowed_epics hecho por add_client_process.
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

  IF current_setting('app.allow_client_process_add', true) = 'on'
     AND TG_OP = 'UPDATE'
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.allowed_categories IS NOT DISTINCT FROM OLD.allowed_categories THEN
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
