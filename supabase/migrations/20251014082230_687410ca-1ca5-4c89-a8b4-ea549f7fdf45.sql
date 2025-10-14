-- Add new columns for corr and ev values
ALTER TABLE monthly_metrics 
ADD COLUMN corr_value numeric DEFAULT 0,
ADD COLUMN ev_value numeric DEFAULT 0;

-- Migrate existing data from value to corr_value
UPDATE monthly_metrics SET corr_value = value WHERE value IS NOT NULL;

-- Drop the old value column
ALTER TABLE monthly_metrics DROP COLUMN value;