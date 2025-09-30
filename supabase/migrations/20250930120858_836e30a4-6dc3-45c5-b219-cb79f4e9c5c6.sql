-- Add UPDATE policy for daily_tasks table
CREATE POLICY "Users can update daily tasks" 
ON daily_tasks 
FOR UPDATE 
USING (true);