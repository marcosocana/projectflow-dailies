-- Ensure public bucket for project logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'project-logos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('project-logos', 'project-logos', true);
  END IF;
END $$;

-- Policies: make logos publicly readable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read project-logos'
  ) THEN
    CREATE POLICY "Public can read project-logos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'project-logos');
  END IF;
END $$;

-- Allow authenticated users to manage files in project-logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can insert project-logos'
  ) THEN
    CREATE POLICY "Authenticated can insert project-logos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'project-logos' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update project-logos'
  ) THEN
    CREATE POLICY "Authenticated can update project-logos"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'project-logos' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete project-logos'
  ) THEN
    CREATE POLICY "Authenticated can delete project-logos"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated');
  END IF;
END $$;