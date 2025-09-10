-- Funciones restantes para completar el sistema

-- 1. Función para obtener permisos de usuario en proyecto
CREATE OR REPLACE FUNCTION public.get_user_project_permissions(
  user_email text,
  project_id uuid
)
RETURNS TABLE (
  section project_section,
  can_access boolean
) AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  
  RETURN QUERY
  SELECT 
    up.section,
    up.can_access
  FROM public.user_permissions up
  WHERE up.user_id = target_user_id 
    AND up.project_id = get_user_project_permissions.project_id
  ORDER BY up.section;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Función para eliminar usuario de proyecto
CREATE OR REPLACE FUNCTION public.remove_user_from_project(
  user_email text,
  project_id uuid
)
RETURNS jsonb AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;
  
  -- Eliminar permisos
  DELETE FROM public.user_permissions 
  WHERE user_id = target_user_id AND project_id = remove_user_from_project.project_id;
  
  -- Eliminar acceso al proyecto
  DELETE FROM public.project_access 
  WHERE user_id = target_user_id AND project_id = remove_user_from_project.project_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Usuario eliminado del proyecto exitosamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Función para listar usuarios de un proyecto
CREATE OR REPLACE FUNCTION public.get_project_users(project_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  is_active boolean,
  granted_at timestamp with time zone,
  granted_by uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    p.is_active,
    pa.created_at as granted_at,
    pa.granted_by
  FROM public.profiles p
  JOIN public.project_access pa ON p.user_id = pa.user_id
  WHERE pa.project_id = get_project_users.project_id
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Función para obtener todos los proyectos de un usuario
CREATE OR REPLACE FUNCTION public.get_user_projects(user_email text)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  project_number integer,
  theme_color text,
  logo_url text,
  granted_at timestamp with time zone
) AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  
  RETURN QUERY
  SELECT 
    proj.id as project_id,
    proj.name as project_name,
    proj.project_number,
    proj.theme_color,
    proj.logo_url,
    pa.created_at as granted_at
  FROM public.projects proj
  JOIN public.project_access pa ON proj.id = pa.project_id
  WHERE pa.user_id = target_user_id
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Función para sincronizar emails existentes (ejecutar una vez)
CREATE OR REPLACE FUNCTION public.sync_existing_profile_emails()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles 
  SET email = au.email
  FROM auth.users au
  WHERE profiles.user_id = au.id 
    AND profiles.email IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ejecutar la sincronización de emails existentes
SELECT public.sync_existing_profile_emails();

-- 6. Función para verificar si un usuario tiene permiso específico
CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_email text,
  project_id uuid,
  section_name text
)
RETURNS boolean AS $$
DECLARE
  target_user_id uuid;
  has_permission boolean := false;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar permiso
  SELECT up.can_access INTO has_permission
  FROM public.user_permissions up
  WHERE up.user_id = target_user_id 
    AND up.project_id = user_has_permission.project_id
    AND up.section = section_name::project_section;
  
  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;