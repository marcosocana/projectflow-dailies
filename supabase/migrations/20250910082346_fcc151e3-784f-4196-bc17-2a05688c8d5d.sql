-- Funciones para gestión de usuarios y permisos

-- 1. Función para sincronizar email del perfil con auth.users
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

-- 2. Trigger para mantener emails sincronizados
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON public.profiles;
CREATE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- 3. Función para buscar usuario por email
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

-- 4. Función para agregar usuario a proyecto
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
    false
  ON CONFLICT (user_id, project_id, section) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'message', 'Usuario agregado exitosamente al proyecto'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;