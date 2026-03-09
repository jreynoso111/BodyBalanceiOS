begin;

alter table public.profiles
  add column if not exists last_premium_granted_at timestamptz;

alter table public.profiles
  add column if not exists last_premium_granted_source text;

alter table public.profiles
  add column if not exists last_premium_granted_notified_at timestamptz;

update public.profiles
set last_premium_granted_at = coalesce(last_premium_granted_at, last_referral_reward_at),
    last_premium_granted_source = coalesce(last_premium_granted_source, 'referral')
where last_referral_reward_at is not null;

alter table public.profiles
  drop constraint if exists profiles_last_premium_granted_source_check;

alter table public.profiles
  add constraint profiles_last_premium_granted_source_check
  check (
    last_premium_granted_source is null
    or last_premium_granted_source = any (array['referral'::text, 'purchase'::text, 'admin'::text])
  );

create or replace function public.get_my_pending_premium_celebration()
returns table (
  source text,
  granted_at timestamptz,
  premium_referral_expires_at timestamptz,
  referral_count integer,
  reward_months integer,
  has_pending boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_referral_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    return;
  end if;

  if v_profile.last_premium_granted_source = 'referral' then
    select count(*)
    into v_referral_count
    from public.referral_code_redemptions
    where inviter_user_id = auth.uid();
  end if;

  return query
  select
    v_profile.last_premium_granted_source,
    v_profile.last_premium_granted_at,
    v_profile.premium_referral_expires_at,
    v_referral_count,
    case when v_profile.last_premium_granted_source = 'referral' then 1 else 0 end,
    coalesce(v_profile.last_premium_granted_at > coalesce(v_profile.last_premium_granted_notified_at, to_timestamp(0)), false);
end;
$$;

revoke all on function public.get_my_pending_premium_celebration() from public;
grant execute on function public.get_my_pending_premium_celebration() to authenticated;

create or replace function public.mark_premium_celebration_seen()
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
  set last_premium_granted_notified_at = greatest(
        coalesce(last_premium_granted_notified_at, to_timestamp(0)),
        coalesce(last_premium_granted_at, now())
      ),
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.mark_premium_celebration_seen() from public;
grant execute on function public.mark_premium_celebration_seen() to authenticated;

create or replace function public.admin_set_profile_plan_tier(p_user_id uuid, p_plan_tier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plan text;
  updated_rows integer;
  previous_plan text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  normalized_plan := case
    when lower(coalesce(p_plan_tier, '')) = 'premium' then 'premium'
    else 'free'
  end;

  select plan_tier
  into previous_plan
  from public.profiles
  where id = p_user_id
  for update;

  update public.profiles
  set plan_tier = normalized_plan,
      last_premium_granted_at = case
        when normalized_plan = 'premium' and coalesce(previous_plan, 'free') <> 'premium' then now()
        else last_premium_granted_at
      end,
      last_premium_granted_source = case
        when normalized_plan = 'premium' and coalesce(previous_plan, 'free') <> 'premium' then 'admin'
        else last_premium_granted_source
      end,
      updated_at = now()
  where id = p_user_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    raise exception 'Profile not found';
  end if;

  return normalized_plan;
end;
$$;

revoke all on function public.admin_set_profile_plan_tier(uuid, text) from public;
grant execute on function public.admin_set_profile_plan_tier(uuid, text) to authenticated;

commit;
