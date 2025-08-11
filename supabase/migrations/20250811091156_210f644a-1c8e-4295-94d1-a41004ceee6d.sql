-- Fix security issues by updating function search paths

-- Update create_shared_notes_history function
CREATE OR REPLACE FUNCTION public.create_shared_notes_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shared_notes_history (note_id, content, edited_by)
  VALUES (OLD.id, OLD.content, OLD.last_edited_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, color)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    '#' || lpad(floor(random() * 16777215)::text, 6, '0')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;