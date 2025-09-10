-- Corregir el problema de recursión infinita eliminando el trigger problemático

-- 1. Eliminar el trigger que está causando la recursión
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON public.profiles;

-- 2. Eliminar la función problemática
DROP FUNCTION IF EXISTS public.sync_profile_email();

-- 3. Sincronizar emails manualmente (solo una vez)
UPDATE public.profiles 
SET email = (
  SELECT email 
  FROM auth.users 
  WHERE auth.users.id = profiles.user_id
)
WHERE email IS NULL OR email = '';

-- 4. Crear las funciones restantes sin el trigger problemático
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

CREATE OR REPLACE FUNCTION public.get_project_users_with_permissions(project_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  is_active boolean,
  granted_at timestamp with time zone,
  permissions jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    p.is_active,
    pa.created_at as granted_at,
    COALESCE(
      jsonb_object_agg(up.section, up.can_access) FILTER (WHERE up.section IS NOT NULL),
      '{}'::jsonb
    ) as permissions
  FROM public.profiles p
  JOIN public.project_access pa ON p.user_id = pa.user_id
  LEFT JOIN public.user_permissions up ON p.user_id = up.user_id AND up.project_id = pa.project_id
  WHERE pa.project_id = get_project_users_with_permissions.project_id
  GROUP BY p.user_id, p.email, p.full_name, p.is_active, pa.created_at
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_email text,
  project_id uuid,
  section_name text
)
RETURNS boolean AS $$
DECLARE
  target_user_id uuid;
  has_permission boolean;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar permiso específico
  SELECT COALESCE(up.can_access, false) INTO has_permission
  FROM public.user_permissions up
  WHERE up.user_id = target_user_id 
    AND up.project_id = user_has_permission.project_id
    AND up.section = section_name::project_section;
  
  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;