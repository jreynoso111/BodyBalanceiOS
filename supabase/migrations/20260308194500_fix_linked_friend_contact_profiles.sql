create or replace function public.resolve_friend_request(
  p_request_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.p2p_requests%rowtype;
  v_sender_payload_name text;
  v_sender_payload_email text;
  v_sender_payload_phone text;
  v_sender_contact_id uuid;
  v_matched_contact_id uuid;
  v_rows_updated integer := 0;
  v_sender_profile_name text;
  v_sender_profile_email text;
  v_sender_profile_phone text;
  v_recipient_profile_name text;
  v_recipient_profile_email text;
  v_recipient_profile_phone text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_action not in ('approved', 'rejected') then
    raise exception 'Unsupported friend request action: %', p_action;
  end if;

  select *
  into v_request
  from public.p2p_requests
  where id = p_request_id
    and type = 'friend_request'
    and to_user_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Friend request not found or already resolved';
  end if;

  if p_action = 'approved' then
    select
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Friend'),
      nullif(trim(p.email), ''),
      nullif(trim(p.phone), '')
    into
      v_sender_profile_name,
      v_sender_profile_email,
      v_sender_profile_phone
    from public.profiles p
    where p.id = v_request.from_user_id;

    select
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Friend'),
      nullif(trim(p.email), ''),
      nullif(trim(p.phone), '')
    into
      v_recipient_profile_name,
      v_recipient_profile_email,
      v_recipient_profile_phone
    from public.profiles p
    where p.id = v_request.to_user_id;

    v_sender_payload_name := nullif(trim(coalesce(v_request.request_payload->>'sender_name', '')), '');
    v_sender_payload_email := nullif(trim(coalesce(v_request.request_payload->>'sender_email', '')), '');
    v_sender_payload_phone := nullif(trim(coalesce(v_request.request_payload->>'sender_phone', '')), '');

    begin
      v_sender_contact_id := nullif(trim(coalesce(v_request.request_payload->>'sender_contact_id', '')), '')::uuid;
    exception
      when others then
        v_sender_contact_id := null;
    end;

    if v_sender_contact_id is not null then
      update public.contacts
      set target_user_id = v_request.to_user_id,
          link_status = 'accepted',
          name = coalesce(v_recipient_profile_name, v_sender_payload_name, name),
          email = coalesce(v_recipient_profile_email, v_sender_payload_email, email),
          phone = coalesce(v_recipient_profile_phone, v_sender_payload_phone, phone)
      where id = v_sender_contact_id
        and user_id = v_request.from_user_id
        and deleted_at is null;

      get diagnostics v_rows_updated = row_count;
    end if;

    if v_rows_updated = 0 then
      update public.contacts
      set target_user_id = v_request.to_user_id,
          link_status = 'accepted',
          name = coalesce(v_recipient_profile_name, v_sender_payload_name, name),
          email = coalesce(v_recipient_profile_email, v_sender_payload_email, email),
          phone = coalesce(v_recipient_profile_phone, v_sender_payload_phone, phone)
      where user_id = v_request.from_user_id
        and target_user_id = v_request.to_user_id
        and link_status = 'pending'
        and deleted_at is null;

      get diagnostics v_rows_updated = row_count;
    end if;

    if v_rows_updated = 0 then
      insert into public.contacts (
        user_id,
        name,
        email,
        phone,
        notes,
        social_network,
        target_user_id,
        link_status
      ) values (
        v_request.from_user_id,
        coalesce(v_recipient_profile_name, v_sender_payload_name, 'Friend'),
        coalesce(v_recipient_profile_email, v_sender_payload_email),
        coalesce(v_recipient_profile_phone, v_sender_payload_phone),
        null,
        null,
        v_request.to_user_id,
        'accepted'
      );
    end if;

    select c.id
    into v_matched_contact_id
    from public.contacts c
    where c.user_id = v_request.to_user_id
      and c.deleted_at is null
      and (
        c.target_user_id = v_request.from_user_id
        or (v_sender_profile_email is not null and lower(coalesce(c.email, '')) = lower(v_sender_profile_email))
        or (v_sender_profile_phone is not null and c.phone = v_sender_profile_phone)
        or lower(coalesce(c.name, '')) = lower(v_sender_profile_name)
      )
    order by
      case when c.target_user_id = v_request.from_user_id then 0 else 1 end,
      c.created_at asc
    limit 1;

    if v_matched_contact_id is not null then
      update public.contacts
      set target_user_id = v_request.from_user_id,
          link_status = 'accepted',
          name = coalesce(v_sender_profile_name, name),
          email = coalesce(v_sender_profile_email, email),
          phone = coalesce(v_sender_profile_phone, phone)
      where id = v_matched_contact_id;
    else
      insert into public.contacts (
        user_id,
        name,
        email,
        phone,
        notes,
        social_network,
        target_user_id,
        link_status
      ) values (
        v_request.to_user_id,
        coalesce(v_sender_profile_name, 'Friend'),
        v_sender_profile_email,
        v_sender_profile_phone,
        null,
        null,
        v_request.from_user_id,
        'accepted'
      );
    end if;
  else
    update public.contacts
    set target_user_id = null,
        link_status = 'private'
    where user_id = v_request.from_user_id
      and target_user_id = v_request.to_user_id
      and link_status = 'pending'
      and deleted_at is null;
  end if;

  update public.p2p_requests
  set status = p_action,
      updated_at = now()
  where id = v_request.id;
end;
$$;

update public.contacts c
set
  name = coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), c.name),
  email = coalesce(nullif(trim(p.email), ''), c.email),
  phone = coalesce(nullif(trim(p.phone), ''), c.phone)
from public.profiles p
where c.target_user_id = p.id
  and c.link_status = 'accepted'
  and c.target_user_id is not null
  and c.deleted_at is null
  and (
    lower(trim(coalesce(c.name, ''))) <> lower(trim(coalesce(p.full_name, p.email, c.name, '')))
    or coalesce(c.email, '') <> coalesce(p.email, '')
    or coalesce(c.phone, '') <> coalesce(p.phone, '')
  );

revoke all on function public.resolve_friend_request(uuid, text) from public;
grant execute on function public.resolve_friend_request(uuid, text) to authenticated;
