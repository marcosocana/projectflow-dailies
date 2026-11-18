-- Solicitante (quién pidió la tarea) e Informado (marcado a mano).
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS requester TEXT,
  ADD COLUMN IF NOT EXISTS informed BOOLEAN NOT NULL DEFAULT false;
