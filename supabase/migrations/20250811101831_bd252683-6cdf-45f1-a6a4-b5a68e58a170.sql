-- Add person_id column to vacations table to link with people from dailies
ALTER TABLE public.vacations 
ADD COLUMN person_id UUID REFERENCES public.people(id);

-- Add index for better performance
CREATE INDEX idx_vacations_person_id ON public.vacations(person_id);