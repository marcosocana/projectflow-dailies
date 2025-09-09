-- Add assigned_to column to tasks table to allow task assignment to team members
ALTER TABLE public.tasks 
ADD COLUMN assigned_to UUID REFERENCES public.people(id) ON DELETE SET NULL;

-- Add type field to vacations table to distinguish between "Baja" and "Vacaciones"
ALTER TABLE public.vacations 
ADD COLUMN type TEXT NOT NULL DEFAULT 'vacaciones' CHECK (type IN ('baja', 'vacaciones'));

-- Create releases table for tracking Web and App releases
CREATE TABLE public.releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'app')),
  version TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for releases
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Create policies for releases
CREATE POLICY "Users can create releases in any project" 
ON public.releases 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view releases from all projects" 
ON public.releases 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update releases in any project" 
ON public.releases 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete releases from any project" 
ON public.releases 
FOR DELETE 
USING (true);

-- Create interesting links table
CREATE TABLE public.interesting_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for interesting links
ALTER TABLE public.interesting_links ENABLE ROW LEVEL SECURITY;

-- Create policies for interesting links
CREATE POLICY "Users can create links in any project" 
ON public.interesting_links 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view links from all projects" 
ON public.interesting_links 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update links in any project" 
ON public.interesting_links 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete links from any project" 
ON public.interesting_links 
FOR DELETE 
USING (true);

-- Add update trigger for releases
CREATE TRIGGER update_releases_updated_at
BEFORE UPDATE ON public.releases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for interesting_links
CREATE TRIGGER update_interesting_links_updated_at
BEFORE UPDATE ON public.interesting_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();