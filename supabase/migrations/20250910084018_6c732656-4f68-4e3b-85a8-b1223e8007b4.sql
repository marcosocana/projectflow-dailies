-- Drop all existing policies for user_permissions and recreate them properly
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view all permissions for projects they have access to" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users with project access can manage permissions" ON public.user_permissions;

-- Create comprehensive policies for user_permissions management
CREATE POLICY "Project members can view permissions" 
ON public.user_permissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

CREATE POLICY "Project members can manage permissions" 
ON public.user_permissions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_access pa
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

CREATE POLICY "Project members can update permissions" 
ON public.user_permissions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_access pa
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

CREATE POLICY "Project members can delete permissions" 
ON public.user_permissions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

-- Give mocanat@minsait.com admin privileges
INSERT INTO public.user_roles (user_id, role)
VALUES ('046273c9-92d8-4bd2-a4d0-7302d79580a2', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Update all permissions for mocanat@minsait.com to have full access
UPDATE public.user_permissions 
SET can_access = true
WHERE user_id = '046273c9-92d8-4bd2-a4d0-7302d79580a2';