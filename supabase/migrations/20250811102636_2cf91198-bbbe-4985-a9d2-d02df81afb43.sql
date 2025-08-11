-- Update projects table to have individual dailies passwords
-- First, let's see what projects exist and set their dailies passwords
UPDATE public.projects 
SET dailies_password = CASE 
  WHEN name = 'm0eve3' OR LOWER(name) LIKE '%m0eve3%' THEN 'm0eve3d'
  ELSE dailies_password
END;

-- Add a comment to document this change
COMMENT ON COLUMN public.projects.dailies_password IS 'Individual dailies password for each project. Default for m0eve3 is m0eve3d';