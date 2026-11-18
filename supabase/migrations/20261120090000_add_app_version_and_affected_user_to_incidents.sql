-- Versión de la app (canal APP o Ambos), y rol/usuario al que le sucede la incidencia.
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS affected_role TEXT,
  ADD COLUMN IF NOT EXISTS affected_user TEXT;
