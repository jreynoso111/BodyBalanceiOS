begin;

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
  v_invitee_created_at timestamptz;
  v_referral_count integer := 0;
  v_new_reward_cycles integer := 0;
  v_cycles_to_award integer := 0;
  v_reward_months integer := 0;
  v_reward_expires_at timestamptz;
  v_base_reward_expires_at timestamptz;
  v_reward_cap_expires_at timestamptz;
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

  select created_at
  into v_invitee_created_at
  from auth.users
  where id = auth.uid();

  if v_invitee_created_at is null then
    raise exception 'Account not found';
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
  join auth.users invitee_user
    on invitee_user.id = r.invitee_user_id
  where r.inviter_user_id = v_inviter.id
    and r.created_at <= invitee_user.created_at + interval '24 hours';

  v_new_reward_cycles := floor(v_referral_count / 3.0)::integer;
  v_cycles_to_award := greatest(v_new_reward_cycles - coalesce(v_inviter.referral_reward_cycles_awarded, 0), 0);

  if v_cycles_to_award > 0 then
    v_base_reward_expires_at := case
      when v_inviter.premium_referral_expires_at is not null and v_inviter.premium_referral_expires_at > now()
        then v_inviter.premium_referral_expires_at
      else now()
    end;
    v_reward_cap_expires_at := now() + interval '2 months';

    if v_base_reward_expires_at + interval '1 month' <= v_reward_cap_expires_at then
      v_reward_months := 1;
      v_reward_expires_at := v_base_reward_expires_at + interval '1 month';
    else
      v_reward_months := 0;
      v_reward_expires_at := v_inviter.premium_referral_expires_at;
    end if;

    update public.profiles
    set premium_referral_expires_at = case
          when v_reward_months > 0 then v_reward_expires_at
          else premium_referral_expires_at
        end,
        referral_reward_cycles_awarded = v_new_reward_cycles,
        last_referral_reward_at = case
          when v_reward_months > 0 then now()
          else last_referral_reward_at
        end,
        last_premium_granted_at = case
          when v_reward_months > 0 then now()
          else last_premium_granted_at
        end,
        last_premium_granted_source = case
          when v_reward_months > 0 then 'referral'
          else last_premium_granted_source
        end,
        updated_at = now()
    where id = v_inviter.id;

    if v_reward_months > 0 then
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
  end if;

  return jsonb_build_object(
    'ok', true,
    'inviter_user_id', v_inviter.id,
    'referral_count', v_referral_count,
    'rewarded', v_reward_months > 0,
    'reward_months', v_reward_months,
    'premium_expires_at', v_reward_expires_at
  );
end;
$$;

revoke all on function public.apply_invitation_code(text) from public;
grant execute on function public.apply_invitation_code(text) to authenticated;

commit;
