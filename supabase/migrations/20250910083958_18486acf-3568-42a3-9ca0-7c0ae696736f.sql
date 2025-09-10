-- Fix RLS policies for user_permissions to allow proper permission management
-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can update permissions for project members" ON public.user_permissions;
DROP POLICY IF EXISTS "Authenticated users can create permissions" ON public.user_permissions;

-- Create more permissive policies for permission management
-- Allow users with project access to manage permissions
CREATE POLICY "Users with project access can manage permissions" 
ON public.user_permissions 
FOR ALL 
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

-- Give mocanat@minsait.com admin privileges
INSERT INTO public.user_roles (user_id, role)
VALUES ('046273c9-92d8-4bd2-a4d0-7302d79580a2', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Update all permissions for mocanat@minsait.com to have full access
UPDATE public.user_permissions 
SET can_access = true
WHERE user_id = '046273c9-92d8-4bd2-a4d0-7302d79580a2';