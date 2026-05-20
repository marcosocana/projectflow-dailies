DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE email = 'macalcedo@minsait.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.people
  SET user_id = NULL
  WHERE user_id = target_user_id;

  DELETE FROM public.user_permissions
  WHERE user_id = target_user_id;

  DELETE FROM public.project_access
  WHERE user_id = target_user_id OR granted_by = target_user_id;

  DELETE FROM public.profiles
  WHERE user_id = target_user_id;

  DELETE FROM auth.users
  WHERE id = target_user_id;
END $$;
