CREATE OR REPLACE FUNCTION public.list_registered_users()
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  email TEXT,
  full_name TEXT,
  color TEXT,
  is_active BOOLEAN,
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
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profiles p
    ON p.user_id = au.id
  ORDER BY
    COALESCE(NULLIF(TRIM(p.full_name), ''), au.email) ASC,
    au.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_registered_users() TO authenticated;
