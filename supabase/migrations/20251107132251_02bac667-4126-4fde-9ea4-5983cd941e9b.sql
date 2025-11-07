-- Add is_urgent field to tasks table
ALTER TABLE tasks ADD COLUMN is_urgent boolean NOT NULL DEFAULT false;