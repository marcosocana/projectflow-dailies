-- Ensure helper function to auto-update updated_at exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create an admin-check function
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'
  );
$$;

-- Ensure RLS is enabled on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- UPDATE policy: owners or admins can update any project
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Owners or admins can update projects'
  ) THEN
    CREATE POLICY "Owners or admins can update projects"
    ON public.projects
    FOR UPDATE
    USING (created_by = auth.uid() OR public.current_user_is_admin())
    WITH CHECK (created_by = auth.uid() OR public.current_user_is_admin());
  END IF;
END $$;

-- DELETE policy: owners or admins can delete projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Owners or admins can delete projects'
  ) THEN
    CREATE POLICY "Owners or admins can delete projects"
    ON public.projects
    FOR DELETE
    USING (created_by = auth.uid() OR public.current_user_is_admin());
  END IF;
END $$;

-- INSERT policy: users can create their own projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users can insert their own projects'
  ) THEN
    CREATE POLICY "Users can insert their own projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- Keep existing SELECT behavior (do not restrict further). Optionally allow admins to select all (safe, additive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Admins can view all projects'
  ) THEN
    CREATE POLICY "Admins can view all projects"
    ON public.projects
    FOR SELECT
    USING (public.current_user_is_admin());
  END IF;
END $$;

-- Add/replace trigger to keep updated_at in sync
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated_at'
  ) THEN
    DROP TRIGGER trg_projects_updated_at ON public.projects;
  END IF;
  CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
END $$;

-- Storage policies for project logos bucket
-- Allow public read (bucket is public) and per-user write to their own folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Project logos are publicly readable'
  ) THEN
    CREATE POLICY "Project logos are publicly readable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'project-logos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own project logos'
  ) THEN
    CREATE POLICY "Users can upload their own project logos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'project-logos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own project logos'
  ) THEN
    CREATE POLICY "Users can update their own project logos"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'project-logos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'project-logos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own project logos'
  ) THEN
    CREATE POLICY "Users can delete their own project logos"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'project-logos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;