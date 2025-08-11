-- Add client info to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS client_email text,
ADD COLUMN IF NOT EXISTS client_phone text;

-- Add explicit title to shared_notes
ALTER TABLE public.shared_notes
ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Nueva nota';

-- Backfill: set existing notes' title to a trimmed version of first 50 chars of content text (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shared_notes' AND column_name='content') THEN
    UPDATE public.shared_notes
    SET title = LEFT(regexp_replace(content, '<[^>]*>', '', 'g'), 50)
    WHERE title IS NULL OR title = '' OR title = 'Nueva nota';
  END IF;
END $$;
