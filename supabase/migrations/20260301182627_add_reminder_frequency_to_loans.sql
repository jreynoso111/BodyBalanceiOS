ALTER TABLE loans 
ADD COLUMN IF NOT EXISTS reminder_frequency text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reminder_interval integer DEFAULT 1;;
