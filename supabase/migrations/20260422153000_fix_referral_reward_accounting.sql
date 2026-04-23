begin;

alter table public.referral_code_redemptions
  add column if not exists reward_consumed_at timestamptz;

create or replace function public.process_referral_reward(p_inviter_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter public.profiles%rowtype;
  v_reward_window_open boolean := false;
  v_available_count integer := 0;
  v_selected_redemption_ids uuid[] := '{}';
  v_reward_expires_at timestamptz;
  v_base_reward_expires_at timestamptz;
begin
  if p_inviter_user_id is null then
    return jsonb_build_object('rewarded', false, 'reason', 'missing_inviter');
  end if;

  select *
  into v_inviter
  from public.profiles
  where id = p_inviter_user_id
  for update;

  if not found then
    return jsonb_build_object('rewarded', false, 'reason', 'profile_not_found');
  end if;

  v_reward_window_open := (
    v_inviter.premium_referral_expires_at is null
    or v_inviter.premium_referral_expires_at <= now() + interval '5 days'
  );

  if not v_reward_window_open then
    return jsonb_build_object('rewarded', false, 'reason', 'window_closed');
  end if;

  select array_agg(redemption_id order by created_at asc), count(*)
  into v_selected_redemption_ids, v_available_count
  from (
    select r.id as redemption_id, r.created_at
    from public.referral_code_redemptions r
    join public.profiles invitee_profile
      on invitee_profile.id = r.invitee_user_id
    where r.inviter_user_id = p_inviter_user_id
      and r.reward_eligible = true
      and r.reward_consumed_at is null
      and r.created_at <= now() - interval '7 days'
      and coalesce(invitee_profile.sign_in_count, 0) > 2
    order by r.created_at asc
    limit 3
  ) eligible_points;

  if v_available_count < 3 then
    return jsonb_build_object('rewarded', false, 'reason', 'not_enough_points', 'available_points', v_available_count);
  end if;

  update public.referral_code_redemptions
  set reward_consumed_at = now()
  where id = any(v_selected_redemption_ids);

  v_base_reward_expires_at := case
    when v_inviter.premium_referral_expires_at is not null and v_inviter.premium_referral_expires_at > now()
      then v_inviter.premium_referral_expires_at
    else now()
  end;

  v_reward_expires_at := v_base_reward_expires_at + interval '1 month';

  update public.profiles
  set premium_referral_expires_at = v_reward_expires_at,
      referral_reward_cycles_awarded = coalesce(referral_reward_cycles_awarded, 0) + 1,
      last_referral_reward_at = now(),
      last_premium_granted_at = now(),
      last_premium_granted_source = 'referral',
      updated_at = now()
  where id = p_inviter_user_id;

  insert into public.p2p_requests (
    type,
    from_user_id,
    to_user_id,
    status,
    message,
    request_payload
  ) values (
    'referral_reward',
    p_inviter_user_id,
    p_inviter_user_id,
    'approved',
    format(
      'Your invite code just unlocked another month. Premium is active until %s.',
      to_char(v_reward_expires_at at time zone 'UTC', 'Mon DD, YYYY')
    ),
    jsonb_build_object(
      'reward_months', 1,
      'referral_count', 3,
      'premium_expires_at', v_reward_expires_at,
      'invite_code', v_inviter.friend_code
    )
  );

  return jsonb_build_object(
    'rewarded', true,
    'reward_months', 1,
    'premium_expires_at', v_reward_expires_at,
    'consumed_redemptions', v_selected_redemption_ids
  );
end;
$$;

revoke all on function public.process_referral_reward(uuid) from public;
grant execute on function public.process_referral_reward(uuid) to authenticated;

create or replace function public.get_my_invite_summary()
returns table (
  invite_code text,
  referral_count integer,
  referrals_until_next_reward integer,
  next_reward_at_uses integer,
  reward_cycles_awarded integer,
  premium_referral_expires_at timestamptz,
  referred_by_user_id uuid,
  referred_by_code text,
  has_unseen_reward boolean,
  latest_reward_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_referral_count integer := 0;
  v_next_reward_threshold integer := 3;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.process_referral_reward(auth.uid());

  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    insert into public.profiles (id)
    values (auth.uid())
    on conflict (id) do nothing;

    perform public.ensure_my_friend_code();

    select *
    into v_profile
    from public.profiles
    where id = auth.uid();
  end if;

  select count(*)
  into v_referral_count
  from public.referral_code_redemptions r
  join public.profiles invitee_profile
    on invitee_profile.id = r.invitee_user_id
  where r.inviter_user_id = auth.uid()
    and r.reward_eligible = true
    and r.reward_consumed_at is null
    and r.created_at <= now() - interval '7 days'
    and coalesce(invitee_profile.sign_in_count, 0) > 2;

  if v_referral_count >= 3 then
    v_next_reward_threshold := ((floor(v_referral_count / 3.0)::integer) + 1) * 3;
  end if;

  return query
  select
    v_profile.friend_code,
    v_referral_count,
    case
      when mod(v_referral_count, 3) = 0 then 3
      else 3 - mod(v_referral_count, 3)
    end,
    v_next_reward_threshold,
    coalesce(v_profile.referral_reward_cycles_awarded, 0),
    v_profile.premium_referral_expires_at,
    v_profile.referred_by_user_id,
    v_profile.referred_by_code,
    coalesce(v_profile.last_referral_reward_at > coalesce(v_profile.last_referral_reward_notified_at, to_timestamp(0)), false),
    v_profile.last_referral_reward_at;
end;
$$;

revoke all on function public.get_my_invite_summary() from public;
grant execute on function public.get_my_invite_summary() to authenticated;

create or replace function public.apply_invitation_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_inviter public.profiles%rowtype;
  v_invitee public.profiles%rowtype;
  v_pending_invite public.referral_email_invites%rowtype;
  v_invitee_created_at timestamptz;
  v_invitee_email text;
  v_reward_window_open boolean := false;
  v_reward_result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_code = '' then
    raise exception 'Invitation code is required';
  end if;

  perform public.ensure_my_friend_code();

  select *
  into v_invitee
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  select created_at, lower(trim(coalesce(email, '')))
  into v_invitee_created_at, v_invitee_email
  from auth.users
  where id = auth.uid();

  if v_invitee_created_at is null then
    raise exception 'Account not found';
  end if;

  if coalesce(v_invitee_email, '') = '' then
    raise exception 'Your account email is required to redeem an invitation code';
  end if;

  if v_invitee_created_at < now() - interval '24 hours' then
    raise exception 'Invitation codes only work for new accounts within 24 hours of signup';
  end if;

  if v_invitee.referred_by_user_id is not null then
    raise exception 'You already used an invitation code';
  end if;

  select *
  into v_inviter
  from public.profiles
  where upper(coalesce(friend_code, '')) = v_code
  for update;

  if not found then
    raise exception 'Invitation code not found';
  end if;

  if v_inviter.id = auth.uid() then
    raise exception 'You cannot use your own invitation code';
  end if;

  select *
  into v_pending_invite
  from public.referral_email_invites
  where lower(trim(invitee_email)) = v_invitee_email
  for update;

  if not found then
    raise exception 'This account email was not invited by a friend';
  end if;

  if v_pending_invite.inviter_user_id <> v_inviter.id then
    raise exception 'This invitation code does not match the email invitation sent to this account';
  end if;

  if exists (
    select 1
    from public.referral_code_redemptions r
    where r.invitee_user_id = auth.uid()
  ) then
    raise exception 'You already used an invitation code';
  end if;

  v_reward_window_open := (
    v_inviter.premium_referral_expires_at is null
    or v_inviter.premium_referral_expires_at <= now() + interval '5 days'
  );

  insert into public.referral_code_redemptions (
    inviter_user_id,
    invitee_user_id,
    code_used,
    reward_eligible
  ) values (
    v_inviter.id,
    auth.uid(),
    v_code,
    v_reward_window_open
  );

  update public.referral_email_invites
  set claimed_by_user_id = auth.uid(),
      claimed_at = coalesce(claimed_at, now()),
      updated_at = now()
  where id = v_pending_invite.id;

  update public.profiles
  set referred_by_user_id = v_inviter.id,
      referred_by_code = v_code,
      updated_at = now()
  where id = auth.uid();

  v_reward_result := public.process_referral_reward(v_inviter.id);

  return jsonb_build_object(
    'ok', true,
    'inviter_user_id', v_inviter.id,
    'reward_window_open', v_reward_window_open,
    'rewarded', coalesce((v_reward_result->>'rewarded')::boolean, false),
    'reward_months', coalesce((v_reward_result->>'reward_months')::integer, 0),
    'premium_expires_at', v_reward_result->>'premium_expires_at'
  );
end;
$$;

revoke all on function public.apply_invitation_code(text) from public;
grant execute on function public.apply_invitation_code(text) to authenticated;

create or replace function public.record_successful_login()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_count integer;
  v_referred_by_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, sign_in_count)
  values (auth.uid(), 1)
  on conflict (id) do update
    set sign_in_count = coalesce(public.profiles.sign_in_count, 0) + 1,
        updated_at = now()
  returning sign_in_count, referred_by_user_id into v_next_count, v_referred_by_user_id;

  if v_referred_by_user_id is not null then
    perform public.process_referral_reward(v_referred_by_user_id);
  end if;

  return v_next_count;
end;
$$;

revoke all on function public.record_successful_login() from public;
grant execute on function public.record_successful_login() to authenticated;

commit;
