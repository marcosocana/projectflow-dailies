-- Dar acceso a mocanat@minsait.com en todos los proyectos para gestionar usuarios
-- Primero asegurar que tiene acceso a todos los proyectos
INSERT INTO public.project_access (user_id, project_id)
SELECT 
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  p.id
FROM public.projects p
ON CONFLICT (user_id, project_id) DO NOTHING;

-- Crear permisos por defecto para todas las secciones en todos los proyectos
INSERT INTO public.user_permissions (user_id, project_id, section, can_access)
SELECT 
  '046273c9-92d8-4bd2-a4d0-7302d79580a2',
  p.id,
  unnest(ARRAY['dailies', 'notes', 'settings', 'tasks', 'users', 'vacations']),
  CASE 
    WHEN unnest(ARRAY['dailies', 'notes', 'settings', 'tasks', 'users', 'vacations']) = 'users' THEN true
    ELSE false
  END
FROM public.projects p
ON CONFLICT (user_id, project_id, section) DO UPDATE SET
  can_access = CASE 
    WHEN user_permissions.section = 'users' THEN true
    ELSE user_permissions.can_access
  END;