-- DB SCHEMA: I GOT YOU
-- Version: 1.0

-- Enable common extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Managed via Auth Trigger)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    currency_default TEXT DEFAULT 'USD',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CONTACTS (Owned by a user)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- 3. LOANS
CREATE TYPE loan_type AS ENUM ('lent', 'borrowed');
CREATE TYPE loan_status AS ENUM ('active', 'partial', 'paid', 'overdue', 'cancelled');

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    type loan_type NOT NULL,
    status loan_status NOT NULL DEFAULT 'active',
    description TEXT,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 4. PAYMENTS
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    note TEXT,
    evidence_url TEXT -- Phase 2
);

-- 5. RLS POLICIES (Security)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contacts" ON contacts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own loans" ON loans FOR ALL USING (auth.uid() = user_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own payments" ON payments FOR ALL USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_contact ON loans(contact_id);
CREATE INDEX idx_payments_loan ON payments(loan_id);

-- TRIGGERS / FUNCTIONS (Logic)

-- Handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-update loan status based on payments
CREATE OR REPLACE FUNCTION update_loan_status_on_payment() RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(15, 2);
    original_amount DECIMAL(15, 2);
BEGIN
    SELECT amount INTO original_amount FROM loans WHERE id = NEW.loan_id;
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE loan_id = NEW.loan_id;
    
    IF total_paid >= original_amount THEN
        UPDATE loans SET status = 'paid' WHERE id = NEW.loan_id;
    ELSIF total_paid > 0 THEN
        UPDATE loans SET status = 'partial' WHERE id = NEW.loan_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_loan_status AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_loan_status_on_payment();
;
