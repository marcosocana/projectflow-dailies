-- Nueva plataforma de releases: Back (con entornos pre y pro).
-- Web ya no usa el entorno dev en la interfaz; los releases antiguos se conservan sin tocar.
ALTER TABLE public.releases DROP CONSTRAINT IF EXISTS releases_platform_check;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_platform_check CHECK (platform IN ('back', 'web', 'app'));
