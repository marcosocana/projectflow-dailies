-- Fix RLS policies for project_access to allow user creation
DROP POLICY IF EXISTS "Admins can manage all project access" ON public.project_access;
DROP POLICY IF EXISTS "Users can view their own project access" ON public.project_access;

-- Allow authenticated users to create project access (for user creation)
CREATE POLICY "Authenticated users can create project access" 
ON public.project_access 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow users to view their own project access
CREATE POLICY "Users can view their own project access" 
ON public.project_access 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to manage all project access
CREATE POLICY "Admins can manage all project access" 
ON public.project_access 
FOR ALL 
TO authenticated
USING (current_user_is_admin());

-- Fix RLS policies for user_permissions to allow creation during user signup
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- Allow authenticated users to create permissions (for user creation)
CREATE POLICY "Authenticated users can create permissions" 
ON public.user_permissions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow users to view their own permissions
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to manage all permissions
CREATE POLICY "Admins can manage all permissions" 
ON public.user_permissions 
FOR ALL 
TO authenticated
USING (current_user_is_admin());

-- Allow admins to update any permissions
CREATE POLICY "Admins can update all permissions" 
ON public.user_permissions 
FOR UPDATE 
TO authenticated
USING (current_user_is_admin());

-- Allow viewing all permissions for the UI table
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