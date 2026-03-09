-- 1. Add role column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'role') THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
END $$;

-- 2. Ensure RLS allows admin access (optional but good practice)
-- Note: Current RLS is user-specific. For now, we'll stick to the user's request.

-- 3. Update the specific user to be an admin
-- Since we don't have the UUID yet, we'll try to find it by email in auth.users
-- This assumes the user 'jreynoso111@gmail.com' already exists in Supabase.
UPDATE profiles 
SET role = 'admin', full_name = 'Reyper'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'jreynoso111@gmail.com'
);

-- 4. In case the profile doesn't exist yet (but the user does), we should create a fallback trigger
-- or manual insert if the ID is known. 
-- Since I can't guarantee the user exists, I'll provide a response if it fails.
;
