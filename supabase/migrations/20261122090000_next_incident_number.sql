-- Siguiente ID manual libre para un tipo de tarea: el más alto del tipo + 1.
-- No cuenta las internas (INT), pero salta los números ya ocupados en ese tipo (el índice
-- único también incluye las internas). Se calcula en servidor para que un cliente, que no
-- ve todas las tareas, obtenga el mismo número que el equipo.
CREATE OR REPLACE FUNCTION public.next_incident_number(_project_id UUID, _category TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_project_data(_project_id) THEN
    RAISE EXCEPTION 'Sin acceso al proyecto';
  END IF;

  IF _category NOT IN ('incident', 'improvement', 'corrective_improvement') THEN
    RAISE EXCEPTION 'Tipo no válido';
  END IF;

  SELECT COALESCE(MAX(i.incident_number), 0) + 1
  INTO v_next
  FROM public.incidents i
  WHERE i.project_id = _project_id
    AND public.incident_effective_category(i.category::TEXT, i.additional_comments) = _category
    AND COALESCE(i.additional_comments, '') NOT LIKE '%[id:int]%';

  WHILE EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.project_id = _project_id
      AND public.incident_effective_category(i.category::TEXT, i.additional_comments) = _category
      AND i.incident_number = v_next
  ) LOOP
    v_next := v_next + 1;
  END LOOP;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.next_incident_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_incident_number(UUID, TEXT) TO authenticated;
