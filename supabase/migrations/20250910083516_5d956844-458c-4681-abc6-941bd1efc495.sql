-- Dar acceso a mocanat@minsait.com en todos los proyectos para gestionar usuarios
-- Primero asegurar que tiene acceso a todos los proyectos
INSERT INTO public.project_access (user_id, project_id)
SELECT 
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  p.id
FROM public.projects p
ON CONFLICT (user_id, project_id) DO NOTHING;

-- Crear permisos por defecto para todas las secciones en todos los proyectos (acceso false por defecto)
INSERT INTO public.user_permissions (user_id, project_id, section, can_access)
SELECT 
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  p.id,
  s.section_name,
  false
FROM public.projects p
CROSS JOIN (
  SELECT unnest(ARRAY['dailies', 'notes', 'settings', 'tasks', 'users', 'vacations']) as section_name
) s 
ON CONFLICT (user_id, project_id, section) DO NOTHING;

-- Dar acceso específico al módulo de usuarios en todos los proyectos
UPDATE public.user_permissions 
SET can_access = true
WHERE user_id = '046273c9-92d8-4bd2-a4d0-7302d79580a2'
  AND section = 'users';