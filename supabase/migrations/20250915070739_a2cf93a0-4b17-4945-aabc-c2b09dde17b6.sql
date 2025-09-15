-- Fix repository_files RLS policies to restrict access to project members only

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view repository files from all projects" ON public.repository_files;
DROP POLICY IF EXISTS "Users can create repository files in any project" ON public.repository_files;
DROP POLICY IF EXISTS "Users can update repository files in any project" ON public.repository_files;
DROP POLICY IF EXISTS "Users can delete repository files from any project" ON public.repository_files;

-- Create secure policies that only allow project members to access files
CREATE POLICY "Project members can view repository files" 
ON public.repository_files 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = repository_files.project_id 
    AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);

CREATE POLICY "Project members can create repository files" 
ON public.repository_files 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = repository_files.project_id 
    AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);

CREATE POLICY "Project members can update repository files" 
ON public.repository_files 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = repository_files.project_id 
    AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = repository_files.project_id 
    AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);

CREATE POLICY "Project members can delete repository files" 
ON public.repository_files 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = repository_files.project_id 
    AND pa.user_id = auth.uid()
  ) OR current_user_is_admin()
);