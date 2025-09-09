-- Add delete function to shared_notes for proper deletion
CREATE OR REPLACE FUNCTION delete_shared_note(note_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete history records first
  DELETE FROM shared_notes_history WHERE note_id = delete_shared_note.note_id;
  
  -- Delete the note
  DELETE FROM shared_notes WHERE id = delete_shared_note.note_id;
END;
$$;