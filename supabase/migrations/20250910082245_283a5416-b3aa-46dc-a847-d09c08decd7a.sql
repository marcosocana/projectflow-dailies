-- 1. Crear enum para las secciones del proyecto
CREATE TYPE public.project_section AS ENUM (
  'home',
  'tasks', 
  'dailies',
  'notes',
  'repository',
  'team',
  'contacts',
  'releases',
  'vacations',
  'settings',
  'users'
);

-- 2. Agregar email a la tabla profiles para búsquedas eficientes
ALTER TABLE public.profiles 
ADD COLUMN email text;

-- 3. Crear índice único en email para profiles
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- 4. Actualizar la tabla user_permissions para usar el enum
ALTER TABLE public.user_permissions 
ALTER COLUMN section TYPE project_section USING section::project_section;

-- 5. Agregar constraint único para evitar permisos duplicados
ALTER TABLE public.user_permissions 
ADD CONSTRAINT unique_user_project_section UNIQUE (user_id, project_id, section);

-- 6. Agregar constraint único para project_access
ALTER TABLE public.project_access 
ADD CONSTRAINT unique_user_project UNIQUE (user_id, project_id);

-- 7. Función para sincronizar email del perfil con auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Al crear o actualizar un perfil, sincronizar el email desde auth.users
  UPDATE public.profiles 
  SET email = (SELECT email FROM auth.users WHERE id = NEW.user_id)
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para mantener emails sincronizados
CREATE OR REPLACE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- 9. Función para buscar usuario por email
CREATE OR REPLACE FUNCTION public.find_user_by_email(user_email text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  is_active boolean,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.email,
    p.is_active,
    p.created_at
  FROM public.profiles p
  WHERE p.email = user_email
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Función para agregar usuario a proyecto
CREATE OR REPLACE FUNCTION public.add_user_to_project(
  user_email text,
  project_id uuid,
  granted_by_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
BEGIN
  -- Buscar usuario por email
  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.email = user_email AND p.is_active = true;
  
  -- Si no existe el usuario, devolver error
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El usuario no está dado de alta en el sistema'
    );
  END IF;
  
  -- Verificar si ya tiene acceso al proyecto
  IF EXISTS (
    SELECT 1 FROM public.project_access 
    WHERE user_id = target_user_id AND project_id = add_user_to_project.project_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El usuario ya tiene acceso a este proyecto'
    );
  END IF;
  
  -- Agregar acceso al proyecto
  INSERT INTO public.project_access (user_id, project_id, granted_by)
  VALUES (target_user_id, add_user_to_project.project_id, granted_by_id);
  
  -- Crear permisos por defecto (todos en false)
  INSERT INTO public.user_permissions (user_id, project_id, section, can_access)
  SELECT 
    target_user_id,
    add_user_to_project.project_id,
    unnest(enum_range(NULL::project_section)),
    false;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'message', 'Usuario agregado exitosamente al proyecto'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Función para actualizar permisos de usuario
CREATE OR REPLACE FUNCTION public.update_user_permissions(
  user_email text,
  project_id uuid,
  permissions jsonb
)
RETURNS jsonb AS $$
DECLARE
  target_user_id uuid;
  section_name text;
  can_access_value boolean;
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
  
  -- Verificar que el usuario tenga acceso al proyecto
  IF NOT EXISTS (
    SELECT 1 FROM public.project_access 
    WHERE user_id = target_user_id AND project_id = update_user_permissions.project_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El usuario no tiene acceso a este proyecto'
    );
  END IF;
  
  -- Actualizar permisos
  FOR section_name, can_access_value IN SELECT * FROM jsonb_each_text(permissions)
  LOOP
    INSERT INTO public.user_permissions (user_id, project_id, section, can_access)
    VALUES (target_user_id, update_user_permissions.project_id, section_name::project_section, can_access_value::boolean)
    ON CONFLICT (user_id, project_id, section)
    DO UPDATE SET 
      can_access = can_access_value::boolean,
      updated_at = now();
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Permisos actualizados exitosamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Función para obtener permisos de usuario en proyecto
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Función para eliminar usuario de proyecto
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Función para listar usuarios de un proyecto
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
$$ LANGUAGE plpgsql SECURITY DEFINER;