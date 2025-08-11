-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (current_user_is_admin());

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (current_user_is_admin());

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (current_user_is_admin());

-- Create vacations table
CREATE TABLE public.vacations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS on vacations
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;

-- Create policies for vacations
CREATE POLICY "Users can view vacations in their projects" 
ON public.vacations 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own vacations" 
ON public.vacations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vacations" 
ON public.vacations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vacations" 
ON public.vacations 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all vacations" 
ON public.vacations 
FOR ALL 
USING (current_user_is_admin());

-- Create shared notes table
CREATE TABLE public.shared_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  last_edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on shared notes
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for shared notes
CREATE POLICY "Users can view shared notes in projects" 
ON public.shared_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create shared notes in projects" 
ON public.shared_notes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update shared notes in projects" 
ON public.shared_notes 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete shared notes" 
ON public.shared_notes 
FOR DELETE 
USING (current_user_is_admin());

-- Create shared notes history for change tracking
CREATE TABLE public.shared_notes_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.shared_notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on shared notes history
ALTER TABLE public.shared_notes_history ENABLE ROW LEVEL SECURITY;

-- Create policies for shared notes history
CREATE POLICY "Users can view shared notes history" 
ON public.shared_notes_history 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert shared notes history" 
ON public.shared_notes_history 
FOR INSERT 
WITH CHECK (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacations_updated_at
BEFORE UPDATE ON public.vacations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_notes_updated_at
BEFORE UPDATE ON public.shared_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for shared notes history
CREATE OR REPLACE FUNCTION public.create_shared_notes_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shared_notes_history (note_id, content, edited_by)
  VALUES (OLD.id, OLD.content, OLD.last_edited_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_shared_notes_history_trigger
BEFORE UPDATE ON public.shared_notes
FOR EACH ROW
EXECUTE FUNCTION public.create_shared_notes_history();

-- Create trigger to automatically create profile when user signs up
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();