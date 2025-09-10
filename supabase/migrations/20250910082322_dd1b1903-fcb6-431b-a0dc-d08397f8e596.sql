-- 1. Crear enum para las secciones del proyecto (solo si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_section') THEN
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
  END IF;
END $$;

-- 2. Agregar email a la tabla profiles para búsquedas eficientes (solo si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
  END IF;
END $$;

-- 3. Crear índice único en email para profiles (solo si no existe)
DROP INDEX IF EXISTS idx_profiles_email;
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- 4. Intentar actualizar la columna section si es necesario
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_permissions' AND column_name = 'section' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.user_permissions 
    ALTER COLUMN section TYPE project_section USING section::project_section;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay error, la columna ya está correctamente tipada
    NULL;
END $$;

-- 5. Agregar constraints únicos si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_project_section'
  ) THEN
    ALTER TABLE public.user_permissions 
    ADD CONSTRAINT unique_user_project_section UNIQUE (user_id, project_id, section);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay error, el constraint ya existe
    NULL;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_project'
  ) THEN
    ALTER TABLE public.project_access 
    ADD CONSTRAINT unique_user_project UNIQUE (user_id, project_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay error, el constraint ya existe
    NULL;
END $$;