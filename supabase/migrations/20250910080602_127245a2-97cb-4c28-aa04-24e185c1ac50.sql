-- Add theme_color column to projects table
ALTER TABLE public.projects 
ADD COLUMN theme_color text NOT NULL DEFAULT '#3B82F6';