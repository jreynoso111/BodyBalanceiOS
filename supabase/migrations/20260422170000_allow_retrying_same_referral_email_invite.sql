create or replace function public.create_referral_email_invite(p_invitee_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_invitee_email, '')));
  v_inviter public.profiles%rowtype;
  v_existing_invite public.referral_email_invites%rowtype;
  v_inviter_email text;
  v_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' then
    raise exception 'Invite email is required';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invite email is invalid';
  end if;

  perform public.ensure_my_friend_code();

  select *
  into v_inviter
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_invite_code := upper(trim(v_inviter.friend_code));

  select lower(trim(coalesce(email, '')))
  into v_inviter_email
  from auth.users
  where id = auth.uid();

  if v_inviter_email <> '' and v_inviter_email = v_email then
    raise exception 'You cannot invite your own email address';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(trim(coalesce(email, ''))) = v_email
  ) then
    raise exception 'This email already belongs to an existing account';
  end if;

  select *
  into v_existing_invite
  from public.referral_email_invites
  where lower(trim(invitee_email)) = v_email
  for update;

  if found then
    if v_existing_invite.claimed_by_user_id is not null then
      raise exception 'This email already completed an invitation';
    end if;

    if v_existing_invite.inviter_user_id = auth.uid() then
      update public.referral_email_invites
      set code_used = v_invite_code,
          updated_at = now()
      where id = v_existing_invite.id;

      return jsonb_build_object(
        'ok', true,
        'invitee_email', v_email,
        'invite_code', v_invite_code
      );
    end if;

    raise exception 'This email was already invited by another account';
  end if;

  insert into public.referral_email_invites (
    inviter_user_id,
    invitee_email,
    code_used
  ) values (
    auth.uid(),
    v_email,
    v_invite_code
  );

  return jsonb_build_object(
    'ok', true,
    'invitee_email', v_email,
    'invite_code', v_invite_code
  );
end;
$$;

revoke all on function public.create_referral_email_invite(text) from public;
grant execute on function public.create_referral_email_invite(text) to authenticated;
