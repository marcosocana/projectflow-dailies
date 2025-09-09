-- Fix the search_path for the delete function
DROP FUNCTION IF EXISTS delete_shared_note(UUID);

CREATE OR REPLACE FUNCTION delete_shared_note(note_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete history records first
  DELETE FROM shared_notes_history WHERE note_id = delete_shared_note.note_id;
  
  -- Delete the note
  DELETE FROM shared_notes WHERE id = delete_shared_note.note_id;
END;
$$;