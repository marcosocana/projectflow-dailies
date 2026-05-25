UPDATE public.tasks t
SET related_ticket = 'INT' || i.incident_number::text
FROM public.incidents i
WHERE t.incident_id = i.id
  AND COALESCE(i.additional_comments, '') LIKE '%[id:int]%'
  AND t.related_ticket IS DISTINCT FROM 'INT' || i.incident_number::text;
