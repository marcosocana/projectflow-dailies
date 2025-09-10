-- Simply grant admin role to mocanat@minsait.com and update permissions
INSERT INTO public.user_roles (user_id, role)
VALUES ('046273c9-92d8-4bd2-a4d0-7302d79580a2', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Update all permissions for mocanat@minsait.com to have full access
UPDATE public.user_permissions 
SET can_access = true
WHERE user_id = '046273c9-92d8-4bd2-a4d0-7302d79580a2';