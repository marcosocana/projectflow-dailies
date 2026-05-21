DROP FUNCTION IF EXISTS public.list_registered_users();

CREATE OR REPLACE FUNCTION public.list_registered_users()
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  email TEXT,
  full_name TEXT,
  color TEXT,
  is_active BOOLEAN,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id AS user_id,
    p.id AS profile_id,
    au.email,
    p.full_name,
    p.color,
    p.is_active,
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = au.id
        AND ur.role = 'admin'::public.app_role
    ) AS is_admin,
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profiles p
    ON p.user_id = au.id
  ORDER BY
    COALESCE(NULLIF(TRIM(p.full_name), ''), au.email) ASC,
    au.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_registered_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_admin_role(target_user_id UUID, make_admin BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Solo un Admin puede modificar permisos de Admin.';
  END IF;

  IF target_user_id = auth.uid() AND make_admin = FALSE THEN
    RAISE EXCEPTION 'No puedes quitarte tus propios permisos de Admin.';
  END IF;

  IF make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = 'admin'::public.app_role;
  END IF;

  RETURN make_admin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_admin_role(UUID, BOOLEAN) TO authenticated;
