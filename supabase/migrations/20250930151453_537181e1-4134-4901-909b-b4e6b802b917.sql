-- Add is_auto_linked column to tasks table to differentiate between automatically linked and manually related tasks
ALTER TABLE public.tasks 
ADD COLUMN is_auto_linked BOOLEAN DEFAULT false;

-- Update existing tasks that have incident_id to be considered manually related (false)
UPDATE public.tasks 
SET is_auto_linked = false 
WHERE incident_id IS NOT NULL;