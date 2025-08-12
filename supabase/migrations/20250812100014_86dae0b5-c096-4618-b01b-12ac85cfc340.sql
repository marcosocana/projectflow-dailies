-- Add new optional text column for epic (Épica) on incidents
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS epic text;