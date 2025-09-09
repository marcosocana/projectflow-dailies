-- Create the missing shared_notes_history table
CREATE TABLE public.shared_notes_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  edited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.shared_notes_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view shared notes history" 
ON public.shared_notes_history 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert shared notes history" 
ON public.shared_notes_history 
FOR INSERT 
WITH CHECK (true);

-- Create trigger to automatically save history when notes are updated
CREATE OR REPLACE FUNCTION public.create_shared_notes_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shared_notes_history (note_id, content, edited_by)
  VALUES (OLD.id, OLD.content, OLD.last_edited_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER shared_notes_history_trigger
  BEFORE UPDATE ON public.shared_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shared_notes_history();