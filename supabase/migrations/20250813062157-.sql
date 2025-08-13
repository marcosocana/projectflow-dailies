-- Secure shared_notes_history to match parent shared_notes visibility via project membership

-- Ensure RLS is enabled
ALTER TABLE public.shared_notes_history ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive existing policies if present
DROP POLICY IF EXISTS "Users can view shared notes history" ON public.shared_notes_history;
DROP POLICY IF EXISTS "System can insert shared notes history" ON public.shared_notes_history;

-- Allow only project members (via project_access) or admins to view history
CREATE POLICY "Project members can view shared notes history"
ON public.shared_notes_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shared_notes sn
    JOIN public.project_access pa
      ON pa.project_id = sn.project_id
    WHERE sn.id = shared_notes_history.note_id
      AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

-- Allow inserts (trigger-created) only when the current user is a member of the note's project or admin
CREATE POLICY "Project members can insert shared notes history"
ON public.shared_notes_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shared_notes sn
    JOIN public.project_access pa
      ON pa.project_id = sn.project_id
    WHERE sn.id = shared_notes_history.note_id
      AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);

-- Allow deleting history only to project members or admins (needed by note/project cleanup flows)
CREATE POLICY "Project members can delete shared notes history"
ON public.shared_notes_history
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shared_notes sn
    JOIN public.project_access pa
      ON pa.project_id = sn.project_id
    WHERE sn.id = shared_notes_history.note_id
      AND pa.user_id = auth.uid()
  )
  OR current_user_is_admin()
);
