-- Crear tabla de permisos de usuario
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('tasks', 'dailies', 'vacations', 'users', 'notes', 'settings')),
  can_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id, section)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para permisos de usuario
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all permissions" 
ON public.user_permissions 
FOR ALL 
USING (current_user_is_admin());

-- Trigger para actualizar timestamps
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear tabla de acceso a proyectos
CREATE TABLE public.project_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;

-- Políticas para acceso a proyectos
CREATE POLICY "Users can view their own project access" 
ON public.project_access 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all project access" 
ON public.project_access 
FOR ALL 
USING (current_user_is_admin());

-- Trigger para actualizar timestamps
CREATE TRIGGER update_project_access_updated_at
BEFORE UPDATE ON public.project_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();