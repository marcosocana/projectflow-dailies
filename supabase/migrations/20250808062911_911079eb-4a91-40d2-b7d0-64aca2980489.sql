-- Create enums for incident management
CREATE TYPE public.incident_status AS ENUM ('pending', 'in_progress', 'closed', 'in_qa', 'resolved');
CREATE TYPE public.incident_category AS ENUM ('incident', 'improvement');

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number SERIAL UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  project_password TEXT NOT NULL,
  dailies_password TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incident_number SERIAL,
  name TEXT NOT NULL,
  description TEXT,
  evidence TEXT, -- Can store file URLs or links
  environment TEXT,
  device TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status incident_status NOT NULL DEFAULT 'pending',
  category incident_category NOT NULL DEFAULT 'incident',
  additional_comments TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, incident_number)
);

-- Create people table for project team members
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6', -- Hex color for visual identification
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dailies table for daily management
CREATE TABLE public.dailies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content JSONB DEFAULT '{}', -- Flexible content storage
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, date)
);

-- Create tasks table for daily tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  daily_id UUID REFERENCES public.dailies(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dailies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects (any authenticated user can read/create)
CREATE POLICY "Authenticated users can view all projects" 
ON public.projects FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create projects" 
ON public.projects FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators can update their projects" 
ON public.projects FOR UPDATE 
TO authenticated 
USING (auth.uid() = created_by);

CREATE POLICY "Project creators can delete their projects" 
ON public.projects FOR DELETE 
TO authenticated 
USING (auth.uid() = created_by);

-- RLS Policies for incidents (project-based access)
CREATE POLICY "Users can view incidents from all projects" 
ON public.incidents FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create incidents in any project" 
ON public.incidents FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update any incident" 
ON public.incidents FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete any incident" 
ON public.incidents FOR DELETE 
TO authenticated 
USING (true);

-- RLS Policies for people (project-based access)
CREATE POLICY "Users can view people from all projects" 
ON public.people FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create people in any project" 
ON public.people FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update people in any project" 
ON public.people FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete people from any project" 
ON public.people FOR DELETE 
TO authenticated 
USING (true);

-- RLS Policies for dailies (project-based access)
CREATE POLICY "Users can view dailies from all projects" 
ON public.dailies FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create dailies in any project" 
ON public.dailies FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update dailies in any project" 
ON public.dailies FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete dailies from any project" 
ON public.dailies FOR DELETE 
TO authenticated 
USING (true);

-- RLS Policies for tasks (project-based access)
CREATE POLICY "Users can view tasks from all projects" 
ON public.tasks FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create tasks in any project" 
ON public.tasks FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update tasks in any project" 
ON public.tasks FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete tasks from any project" 
ON public.tasks FOR DELETE 
TO authenticated 
USING (true);

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Storage policies for project files
CREATE POLICY "Authenticated users can view project files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can upload project files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can update project files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can delete project files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'project-files');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dailies_updated_at
  BEFORE UPDATE ON public.dailies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();