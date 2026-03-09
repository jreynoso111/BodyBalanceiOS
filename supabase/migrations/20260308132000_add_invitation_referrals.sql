begin;

alter table public.profiles
  add column if not exists premium_referral_expires_at timestamptz;

alter table public.profiles
  add column if not exists referred_by_user_id uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists referred_by_code text;

alter table public.profiles
  add column if not exists referral_reward_cycles_awarded integer not null default 0;

alter table public.profiles
  add column if not exists last_referral_reward_at timestamptz;

alter table public.profiles
  add column if not exists last_referral_reward_notified_at timestamptz;

create table if not exists public.referral_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  invitee_user_id uuid not null references public.profiles(id) on delete cascade,
  code_used text not null,
  created_at timestamptz not null default now(),
  constraint referral_code_redemptions_inviter_not_invitee_check check (inviter_user_id <> invitee_user_id),
  constraint referral_code_redemptions_invitee_unique unique (invitee_user_id)
);

create index if not exists referral_code_redemptions_inviter_user_id_idx
  on public.referral_code_redemptions(inviter_user_id);

alter table public.referral_code_redemptions enable row level security;

drop policy if exists referral_code_redemptions_select_involved on public.referral_code_redemptions;
create policy referral_code_redemptions_select_involved
on public.referral_code_redemptions
for select
to authenticated
using (inviter_user_id = auth.uid() or invitee_user_id = auth.uid());

alter table public.p2p_requests
drop constraint if exists p2p_requests_type_check;

alter table public.p2p_requests
add constraint p2p_requests_type_check
check (
  type = any (
    array[
      'loan_validation'::text,
      'payment_validation'::text,
      'payment_notice'::text,
      'debt_reduction'::text,
      'friend_request'::text,
      'referral_reward'::text
    ]
  )
);

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
  where r.inviter_user_id = auth.uid();

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
  v_referral_count integer := 0;
  v_new_reward_cycles integer := 0;
  v_cycles_to_award integer := 0;
  v_reward_months integer := 0;
  v_reward_expires_at timestamptz;
  v_base_reward_expires_at timestamptz;
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

  if exists (
    select 1
    from public.referral_code_redemptions r
    where r.invitee_user_id = auth.uid()
  ) then
    raise exception 'You already used an invitation code';
  end if;

  insert into public.referral_code_redemptions (
    inviter_user_id,
    invitee_user_id,
    code_used
  ) values (
    v_inviter.id,
    auth.uid(),
    v_code
  );

  update public.profiles
  set referred_by_user_id = v_inviter.id,
      referred_by_code = v_code,
      updated_at = now()
  where id = auth.uid();

  select count(*)
  into v_referral_count
  from public.referral_code_redemptions r
  where r.inviter_user_id = v_inviter.id;

  v_new_reward_cycles := floor(v_referral_count / 3.0)::integer;
  v_cycles_to_award := greatest(v_new_reward_cycles - coalesce(v_inviter.referral_reward_cycles_awarded, 0), 0);

  if v_cycles_to_award > 0 then
    v_reward_months := v_cycles_to_award;
    v_base_reward_expires_at := case
      when v_inviter.premium_referral_expires_at is not null and v_inviter.premium_referral_expires_at > now()
        then v_inviter.premium_referral_expires_at
      else now()
    end;
    v_reward_expires_at := v_base_reward_expires_at + make_interval(months => v_reward_months);

    update public.profiles
    set premium_referral_expires_at = v_reward_expires_at,
        referral_reward_cycles_awarded = v_new_reward_cycles,
        last_referral_reward_at = now(),
        last_premium_granted_at = now(),
        last_premium_granted_source = 'referral',
        updated_at = now()
    where id = v_inviter.id;

    insert into public.p2p_requests (
      type,
      from_user_id,
      to_user_id,
      status,
      message,
      request_payload
    ) values (
      'referral_reward',
      auth.uid(),
      v_inviter.id,
      'approved',
      format(
        'Your invite code just hit %s uses. Premium is active until %s.',
        v_referral_count,
        to_char(v_reward_expires_at at time zone 'UTC', 'Mon DD, YYYY')
      ),
      jsonb_build_object(
        'reward_months', v_reward_months,
        'referral_count', v_referral_count,
        'premium_expires_at', v_reward_expires_at,
        'invite_code', v_inviter.friend_code
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'inviter_user_id', v_inviter.id,
    'referral_count', v_referral_count,
    'rewarded', v_cycles_to_award > 0,
    'reward_months', v_reward_months,
    'premium_expires_at', v_reward_expires_at
  );
end;
$$;

revoke all on function public.apply_invitation_code(text) from public;
grant execute on function public.apply_invitation_code(text) to authenticated;

create or replace function public.mark_latest_referral_reward_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set last_referral_reward_notified_at = greatest(
        coalesce(last_referral_reward_notified_at, to_timestamp(0)),
        coalesce(last_referral_reward_at, now())
      ),
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.mark_latest_referral_reward_seen() from public;
grant execute on function public.mark_latest_referral_reward_seen() to authenticated;

commit;
