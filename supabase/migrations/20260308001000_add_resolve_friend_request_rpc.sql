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
  v_sender_name text;
  v_sender_email text;
  v_sender_phone text;
  v_sender_notes text;
  v_sender_social text;
  v_sender_contact_id uuid;
  v_matched_contact_id uuid;
  v_rows_updated integer := 0;
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
    v_sender_name := coalesce(
      nullif(trim(coalesce(v_request.request_payload->>'sender_name', '')), ''),
      nullif(trim((select p.full_name from public.profiles p where p.id = v_request.from_user_id)), ''),
      nullif(trim((select p.email from public.profiles p where p.id = v_request.from_user_id)), ''),
      'Friend'
    );
    v_sender_email := nullif(trim(coalesce(v_request.request_payload->>'sender_email', '')), '');
    v_sender_phone := nullif(trim(coalesce(v_request.request_payload->>'sender_phone', '')), '');
    v_sender_notes := nullif(trim(coalesce(v_request.request_payload->>'sender_notes', '')), '');
    v_sender_social := nullif(trim(coalesce(v_request.request_payload->>'sender_social_network', '')), '');

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
          updated_at = now()
      where id = v_sender_contact_id
        and user_id = v_request.from_user_id
        and deleted_at is null;

      get diagnostics v_rows_updated = row_count;
    end if;

    if v_rows_updated = 0 then
      update public.contacts
      set target_user_id = v_request.to_user_id,
          link_status = 'accepted',
          updated_at = now()
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
        v_sender_name,
        v_sender_email,
        v_sender_phone,
        v_sender_notes,
        v_sender_social,
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
        or (v_sender_email is not null and lower(coalesce(c.email, '')) = lower(v_sender_email))
        or (v_sender_phone is not null and c.phone = v_sender_phone)
        or lower(coalesce(c.name, '')) = lower(v_sender_name)
      )
    order by
      case when c.target_user_id = v_request.from_user_id then 0 else 1 end,
      c.created_at asc
    limit 1;

    if v_matched_contact_id is not null then
      update public.contacts
      set target_user_id = v_request.from_user_id,
          link_status = 'accepted',
          name = coalesce(nullif(trim(name), ''), v_sender_name),
          email = coalesce(email, v_sender_email),
          phone = coalesce(phone, v_sender_phone),
          social_network = coalesce(social_network, v_sender_social),
          notes = coalesce(notes, v_sender_notes),
          updated_at = now()
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
        v_sender_name,
        v_sender_email,
        v_sender_phone,
        v_sender_notes,
        v_sender_social,
        v_request.from_user_id,
        'accepted'
      );
    end if;
  else
    update public.contacts
    set target_user_id = null,
        link_status = 'private',
        updated_at = now()
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

revoke all on function public.resolve_friend_request(uuid, text) from public;
grant execute on function public.resolve_friend_request(uuid, text) to authenticated;
