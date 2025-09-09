-- Add assigned_to column to incidents table to store the team member assigned to the task
ALTER TABLE public.incidents 
ADD COLUMN assigned_to UUID REFERENCES public.people(id) ON DELETE SET NULL;