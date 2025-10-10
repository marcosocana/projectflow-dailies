-- Eliminar la tabla incorrecta
DROP TABLE IF EXISTS public.task_assignments CASCADE;

-- Crear tabla de asignaciones que referencia correctamente a incidents
CREATE TABLE IF NOT EXISTS public.incident_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  status incident_status NOT NULL DEFAULT 'pending'::incident_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(incident_id, assigned_to)
);

-- Habilitar RLS
ALTER TABLE public.incident_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view incident assignments"
  ON public.incident_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create incident assignments"
  ON public.incident_assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update incident assignments"
  ON public.incident_assignments
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete incident assignments"
  ON public.incident_assignments
  FOR DELETE
  USING (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_incident_assignments_updated_at
  BEFORE UPDATE ON public.incident_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar datos existentes de incidents.assigned_to a incident_assignments
INSERT INTO public.incident_assignments (incident_id, assigned_to, status)
SELECT id, assigned_to, status
FROM public.incidents
WHERE assigned_to IS NOT NULL
ON CONFLICT (incident_id, assigned_to) DO NOTHING;

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_incident_assignments_incident_id ON public.incident_assignments(incident_id);
CREATE INDEX idx_incident_assignments_assigned_to ON public.incident_assignments(assigned_to);