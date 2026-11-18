-- Unifica las épicas existentes en los procesos definitivos (el campo "epic" pasa a
-- llamarse "Proceso" en la interfaz). Re-ejecutable: lo que ya esté unificado no cambia.
DO $$
DECLARE
  m jsonb := '{
    "Avisos de Mantenimiento": "Avisos de mantenimiento",
    "Avisos de mto": "Avisos de mantenimiento",
    "Avisos de mto.": "Avisos de mantenimiento",
    "Ronda del Operador": "Ronda del operador",
    "Ronda del Operador/Avisos de Mantenimiento": "Ronda del operador",
    "Rondas del Operador/Gamas de Mantenimiento": "Ronda del operador",
    "Gamas de Mantenimiento": "Gamas de mantenimiento",
    "Gamas de mantenimiento/Rondas del operador": "Gamas de mantenimiento",
    "Ronda del operador/Gamas de mantenimiento": "Ronda del operador",
    "Planificacion del mantenimiento": "Planificación del mantenimiento",
    "Planificación": "Planificación del mantenimiento",
    "Ejecución de mantenimiento": "Ejecución del mantenimiento",
    "Ejecucion del mantenimiento": "Ejecución del mantenimiento",
    "Fugas de vapor/Purgadores": "Fugas de vapor/purgadores",
    "Fugas de Vapor/Purgadores": "Fugas de vapor/purgadores",
    "Gestion de Usuarios": "Gestión de usuarios",
    "Gamas Purgadores - Gestor de Purgadores": "Gamas purgadores",
    "Todos los procesos (nace en Gamas de Mto.)": "Todos los procesos",
    "Todos los procesos (nace en RO.)": "Todos los procesos",
    "Global": "Todos los procesos",
    "Nuevo proceso": "Otros",
    "Acceso Movil/Tablet": "Otros",
    "Datadog": "Otros",
    "Datos Maestros": "Otros",
    "MyIndustrialIT": "Otros",
    "Notificaciones": "Otros"
  }';
BEGIN
  -- Tareas
  UPDATE public.incidents
  SET epic = m ->> epic
  WHERE m ->> epic IS NOT NULL;

  -- Procesos permitidos de los clientes
  UPDATE public.project_access
  SET allowed_epics = (
    SELECT array_agg(DISTINCT COALESCE(m ->> e, e))
    FROM unnest(allowed_epics) AS e
  )
  WHERE allowed_epics IS NOT NULL
    AND EXISTS (SELECT 1 FROM unnest(allowed_epics) AS e WHERE m ->> e IS NOT NULL);
END $$;
