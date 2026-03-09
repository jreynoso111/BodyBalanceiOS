ALTER TABLE loans 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'money' CHECK (category IN ('money', 'item')),
ADD COLUMN IF NOT EXISTS item_name TEXT,
ALTER COLUMN amount DROP NOT NULL;;
