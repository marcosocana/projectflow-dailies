-- Add order_position column to incidents table
ALTER TABLE public.incidents 
ADD COLUMN order_position INTEGER DEFAULT 0;

-- Create index for better performance
CREATE INDEX idx_incidents_order_position ON public.incidents(project_id, order_position);