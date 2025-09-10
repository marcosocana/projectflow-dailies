-- Crear perfil para el usuario mocanat@minsait.com
INSERT INTO public.profiles (user_id, full_name, email, color, is_active)
VALUES (
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  'mocanat@minsait.com',
  'mocanat@minsait.com',
  '#3B82F6',
  true
) ON CONFLICT (user_id) DO UPDATE SET
  email = 'mocanat@minsait.com',
  is_active = true;

-- Dar acceso al proyecto FFF
INSERT INTO public.project_access (user_id, project_id)
VALUES (
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  '9684ab38-50e6-4830-856e-0ebaa4e51a26'
) ON CONFLICT (user_id, project_id) DO NOTHING;

-- Crear permisos por defecto para todas las secciones
INSERT INTO public.user_permissions (user_id, project_id, section, can_access)
SELECT 
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  '9684ab38-50e6-4830-856e-0ebaa4e51a26',
  unnest(ARRAY['dailies', 'notes', 'settings', 'tasks', 'users', 'vacations']),
  false
ON CONFLICT (user_id, project_id, section) DO NOTHING;

-- Dar acceso específico al módulo de usuarios
UPDATE public.user_permissions 
SET can_access = true
WHERE user_id = '046273c9-92d8-4bd2-a4d0-7302d79580a2'
  AND project_id = '9684ab38-50e6-4830-856e-0ebaa4e51a26'
  AND section = 'users';