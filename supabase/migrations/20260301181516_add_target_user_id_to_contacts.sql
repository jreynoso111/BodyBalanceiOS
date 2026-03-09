-- Add target_user_id to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_contacts_target_user_id ON contacts(target_user_id);;
