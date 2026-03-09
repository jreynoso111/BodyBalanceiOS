-- Admin RLS Policies for Profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (public.is_admin());

-- Admin RLS Policies for Loans
DROP POLICY IF EXISTS "Admins can manage all loans" ON loans;
CREATE POLICY "Admins can manage all loans" ON loans FOR ALL USING (public.is_admin());

-- Admin RLS Policies for Payments
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
CREATE POLICY "Admins can manage all payments" ON payments FOR ALL USING (public.is_admin());

-- Admin RLS Policies for Contacts
DROP POLICY IF EXISTS "Admins can manage all contacts" ON contacts;
CREATE POLICY "Admins can manage all contacts" ON contacts FOR ALL USING (public.is_admin());

-- RPC for Admin Dashboard Stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users INT;
  v_total_loans INT;
  v_active_loans INT;
  v_money_in_transit NUMERIC;
BEGIN
  -- Authenticate admin status
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total_users FROM profiles;
  SELECT count(*) INTO v_total_loans FROM loans;
  SELECT count(*) INTO v_active_loans FROM loans WHERE status = 'active';
  SELECT coalesce(sum(amount), 0) INTO v_money_in_transit FROM loans WHERE status = 'active' AND category = 'money';

  RETURN json_build_object(
    'total_users', v_total_users,
    'total_loans', v_total_loans,
    'active_loans', v_active_loans,
    'money_in_transit', v_money_in_transit
  );
END;
$$;;
