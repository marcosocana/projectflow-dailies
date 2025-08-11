-- Fix RLS policies for user_permissions upsert operation
-- The current policies don't allow proper upsert operations

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can create permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can update all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view all permissions for projects they have access to" ON public.user_permissions;

-- Allow authenticated users to create permissions
CREATE POLICY "Authenticated users can create permissions" 
ON public.user_permissions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update permissions for users in projects they have access to
CREATE POLICY "Users can update permissions for project members" 
ON public.user_permissions 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

-- Allow users to view their own permissions
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow viewing all permissions for projects the user has access to
CREATE POLICY "Users can view all permissions for projects they have access to" 
ON public.user_permissions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_access pa 
    WHERE pa.project_id = user_permissions.project_id 
    AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

-- Allow admins to manage all permissions
CREATE POLICY "Admins can manage all permissions" 
ON public.user_permissions 
FOR ALL 
TO authenticated
USING (current_user_is_admin());