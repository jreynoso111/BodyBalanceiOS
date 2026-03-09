ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('money', 'item')) DEFAULT 'money';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS returned_item_name text;
ALTER TABLE payments ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK ((payment_method = 'money' AND amount > 0) OR (payment_method = 'item'));;
