-- Crear tabla para asignaciones múltiples de tareas
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  status task_status NOT NULL DEFAULT 'pending'::task_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, assigned_to)
);

-- Habilitar RLS
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view task assignments"
  ON public.task_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create task assignments"
  ON public.task_assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update task assignments"
  ON public.task_assignments
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete task assignments"
  ON public.task_assignments
  FOR DELETE
  USING (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_task_assignments_updated_at
  BEFORE UPDATE ON public.task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar datos existentes de tasks.assigned_to a task_assignments
INSERT INTO public.task_assignments (task_id, assigned_to, status)
SELECT id, assigned_to, status
FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, assigned_to) DO NOTHING;

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX idx_task_assignments_assigned_to ON public.task_assignments(assigned_to);