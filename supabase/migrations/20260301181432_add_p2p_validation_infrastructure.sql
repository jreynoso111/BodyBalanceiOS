-- Add email and phone to profiles for discovery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Add target_user_id and validation_status to loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES profiles(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'none' CHECK (validation_status IN ('none', 'pending', 'approved', 'rejected'));

-- Add target_user_id and validation_status to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES profiles(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'none' CHECK (validation_status IN ('none', 'pending', 'approved', 'rejected'));

-- Create P2P requests table
CREATE TABLE IF NOT EXISTS p2p_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('loan_validation', 'payment_validation', 'debt_reduction')),
    loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
    payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
    from_user_id uuid REFERENCES profiles(id) NOT NULL,
    to_user_id uuid REFERENCES profiles(id) NOT NULL,
    message text,
    data jsonb,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for p2p_requests
ALTER TABLE p2p_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see requests sent to or from them"
    ON p2p_requests FOR SELECT
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert requests if they are the sender"
    ON p2p_requests FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update requests if they are involved"
    ON p2p_requests FOR UPDATE
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);;
