-- Create contacts table for project contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can view contacts from all projects" 
ON public.contacts 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create contacts in any project" 
ON public.contacts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update contacts in any project" 
ON public.contacts 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete contacts from any project" 
ON public.contacts 
FOR DELETE 
USING (true);

-- Create repository files table
CREATE TABLE public.repository_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  password_required BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.repository_files ENABLE ROW LEVEL SECURITY;

-- Create policies for repository files
CREATE POLICY "Users can view repository files from all projects" 
ON public.repository_files 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create repository files in any project" 
ON public.repository_files 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update repository files in any project" 
ON public.repository_files 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete repository files from any project" 
ON public.repository_files 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates on contacts
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on repository files
CREATE TRIGGER update_repository_files_updated_at
BEFORE UPDATE ON public.repository_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();