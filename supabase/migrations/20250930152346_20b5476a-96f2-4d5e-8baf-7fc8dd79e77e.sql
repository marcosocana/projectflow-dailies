-- Add related_ticket column to tasks table for manual ticket references
ALTER TABLE public.tasks ADD COLUMN related_ticket text;

COMMENT ON COLUMN public.tasks.related_ticket IS 'Manually entered ticket reference (not auto-linked)';
