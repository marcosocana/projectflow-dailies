-- 1. Crear enum para las secciones del proyecto
CREATE TYPE public.project_section AS ENUM (
  'home',
  'tasks', 
  'dailies',
  'notes',
  'repository',
  'team',
  'contacts',
  'releases',
  'vacations',
  'settings',
  'users'
);

-- 2. Agregar email a la tabla profiles para búsquedas eficientes
ALTER TABLE public.profiles 
ADD COLUMN email text;

-- 3. Crear índice único en email para profiles
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- 4. Crear nueva columna temporal para la conversión
ALTER TABLE public.user_permissions 
ADD COLUMN section_new project_section;

-- 5. Migrar datos existentes con mapeo de secciones
UPDATE public.user_permissions 
SET section_new = CASE 
  WHEN section = 'home' THEN 'home'::project_section
  WHEN section = 'tasks' THEN 'tasks'::project_section
  WHEN section = 'dailies' THEN 'dailies'::project_section
  WHEN section = 'notes' THEN 'notes'::project_section
  WHEN section = 'repository' THEN 'repository'::project_section
  WHEN section = 'team' THEN 'team'::project_section
  WHEN section = 'contacts' THEN 'contacts'::project_section
  WHEN section = 'releases' THEN 'releases'::project_section
  WHEN section = 'vacations' THEN 'vacations'::project_section
  WHEN section = 'settings' THEN 'settings'::project_section
  WHEN section = 'users' THEN 'users'::project_section
  ELSE 'home'::project_section -- valor por defecto
END;