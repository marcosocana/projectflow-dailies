-- Add environment column to releases table
ALTER TABLE public.releases 
ADD COLUMN environment text NOT NULL DEFAULT 'pro';

-- Add check constraint to ensure valid environments
ALTER TABLE public.releases 
ADD CONSTRAINT releases_environment_check 
CHECK (environment IN ('dev', 'pre', 'pro'));

-- Update existing records to have 'pro' environment
UPDATE public.releases SET environment = 'pro' WHERE environment IS NULL;

-- Add comment to describe the environment column
COMMENT ON COLUMN public.releases.environment IS 'Environment: dev, pre, pro for web; pre, pro for app';