CREATE UNIQUE INDEX IF NOT EXISTS people_user_id_unique_idx
  ON public.people (user_id)
  WHERE user_id IS NOT NULL;
