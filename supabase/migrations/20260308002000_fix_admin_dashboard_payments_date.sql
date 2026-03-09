create or replace function public.get_admin_dashboard_stats()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_total_users int := 0;
  v_new_users_7d int := 0;
  v_new_users_30d int := 0;
  v_active_users_7d int := 0;
  v_active_users_30d int := 0;
  v_premium_users int := 0;
  v_free_users int := 0;
  v_premium_new_7d int := 0;
  v_total_loans int := 0;
  v_active_loans int := 0;
  v_money_in_transit numeric := 0;
  v_records_created_7d int := 0;
  v_payments_logged_7d int := 0;
  v_pending_confirmations int := 0;
  v_pending_friend_requests int := 0;
  v_push_enabled_users int := 0;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select count(*) into v_total_users from public.profiles;

  select count(*)
    into v_new_users_7d
  from auth.users
  where created_at >= now() - interval '7 days';

  select count(*)
    into v_new_users_30d
  from auth.users
  where created_at >= now() - interval '30 days';

  select count(distinct actor_user_id)
    into v_active_users_7d
  from public.audit_logs
  where actor_user_id is not null
    and created_at >= now() - interval '7 days';

  select count(distinct actor_user_id)
    into v_active_users_30d
  from public.audit_logs
  where actor_user_id is not null
    and created_at >= now() - interval '30 days';

  select
    count(*) filter (where coalesce(plan_tier, 'free') = 'premium'),
    count(*) filter (where coalesce(plan_tier, 'free') <> 'premium')
    into v_premium_users, v_free_users
  from public.profiles;

  select count(*)
    into v_premium_new_7d
  from public.audit_logs
  where table_name = 'profiles'
    and created_at >= now() - interval '7 days'
    and (
      coalesce(new_row ->> 'plan_tier', 'free') = 'premium'
      and coalesce(old_row ->> 'plan_tier', 'free') <> 'premium'
    );

  select count(*) into v_total_loans from public.loans where deleted_at is null;

  select count(*) into v_active_loans
  from public.loans
  where deleted_at is null
    and status in ('active', 'partial', 'overdue');

  select coalesce(sum(amount), 0) into v_money_in_transit
  from public.loans
  where deleted_at is null
    and status in ('active', 'partial', 'overdue')
    and category = 'money';

  select count(*) into v_records_created_7d
  from public.loans
  where deleted_at is null
    and created_at >= now() - interval '7 days';

  select count(*) into v_payments_logged_7d
  from public.payments
  where payment_date >= now() - interval '7 days';

  select count(*) into v_pending_confirmations
  from public.p2p_requests
  where status = 'pending';

  select count(*) into v_pending_friend_requests
  from public.p2p_requests
  where status = 'pending'
    and type = 'friend_request';

  select count(*)
    into v_push_enabled_users
  from public.user_preferences
  where push_enabled = true;

  return json_build_object(
    'total_users', v_total_users,
    'new_users_7d', v_new_users_7d,
    'new_users_30d', v_new_users_30d,
    'active_users_7d', v_active_users_7d,
    'active_users_30d', v_active_users_30d,
    'premium_users', v_premium_users,
    'free_users', v_free_users,
    'premium_new_7d', v_premium_new_7d,
    'total_loans', v_total_loans,
    'active_loans', v_active_loans,
    'money_in_transit', v_money_in_transit,
    'records_created_7d', v_records_created_7d,
    'payments_logged_7d', v_payments_logged_7d,
    'pending_confirmations', v_pending_confirmations,
    'pending_friend_requests', v_pending_friend_requests,
    'push_enabled_users', v_push_enabled_users
  );
end;
$$;
