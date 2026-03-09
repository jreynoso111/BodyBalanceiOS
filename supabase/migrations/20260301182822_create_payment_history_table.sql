CREATE TABLE IF NOT EXISTS payment_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
    changed_by uuid REFERENCES auth.users(id),
    old_amount numeric,
    new_amount numeric,
    old_note text,
    new_note text,
    old_item_name text,
    new_item_name text,
    change_reason text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view history of their payments" ON payment_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM payments p 
            WHERE p.id = payment_history.payment_id 
            AND (p.user_id = auth.uid() OR p.target_user_id = auth.uid())
        )
    );
;
