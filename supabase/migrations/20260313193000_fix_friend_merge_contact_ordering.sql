begin;

create or replace function public.resolve_friend_request_v2(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.p2p_requests%rowtype;
  v_sender_payload_name text;
  v_sender_payload_email text;
  v_sender_payload_phone text;
  v_sender_notes text;
  v_sender_social text;
  v_sender_contact_id uuid;
  v_recipient_contact_id uuid;
  v_matched_contact_id uuid;
  v_rows_updated integer := 0;
  v_sender_profile_name text;
  v_sender_profile_email text;
  v_sender_profile_phone text;
  v_recipient_profile_name text;
  v_recipient_profile_email text;
  v_recipient_profile_phone text;
  v_sender_summary jsonb := '{}'::jsonb;
  v_recipient_summary jsonb := '{}'::jsonb;
  v_sender_records integer := 0;
  v_recipient_records integer := 0;
  v_merge_key text;
  v_sync_result jsonb := '{}'::jsonb;
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

  if p_action = 'rejected' then
    update public.contacts
    set target_user_id = null,
        link_status = 'private'
    where user_id = v_request.from_user_id
      and target_user_id = v_request.to_user_id
      and link_status = 'pending'
      and deleted_at is null;

    update public.p2p_requests
    set status = p_action,
        updated_at = now()
    where id = v_request.id;

    return jsonb_build_object('status', 'rejected');
  end if;

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
        link_status = 'pending',
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
        link_status = 'pending',
        name = coalesce(v_recipient_profile_name, v_sender_payload_name, name),
        email = coalesce(v_recipient_profile_email, v_sender_payload_email, email),
        phone = coalesce(v_recipient_profile_phone, v_sender_payload_phone, phone)
    where user_id = v_request.from_user_id
      and target_user_id = v_request.to_user_id
      and link_status = 'pending'
      and deleted_at is null;

    get diagnostics v_rows_updated = row_count;

    if v_rows_updated > 0 then
      select c.id
      into v_sender_contact_id
      from public.contacts c
      where c.user_id = v_request.from_user_id
        and c.target_user_id = v_request.to_user_id
        and c.link_status = 'pending'
        and c.deleted_at is null
      order by c.id asc
      limit 1;
    end if;
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
      'pending'
    )
    returning id into v_sender_contact_id;
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
    c.id asc
  limit 1;

  if v_matched_contact_id is not null then
    update public.contacts
    set target_user_id = v_request.from_user_id,
        link_status = 'pending',
        name = coalesce(v_sender_profile_name, name),
        email = coalesce(v_sender_profile_email, email),
        phone = coalesce(v_sender_profile_phone, phone),
        notes = coalesce(notes, v_sender_notes),
        social_network = coalesce(social_network, v_sender_social)
    where id = v_matched_contact_id
    returning id into v_recipient_contact_id;
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
      v_sender_notes,
      v_sender_social,
      v_request.from_user_id,
      'pending'
    )
    returning id into v_recipient_contact_id;
  end if;

  v_sender_summary := public.get_contact_ledger_summary(v_request.from_user_id, v_sender_contact_id);
  v_recipient_summary := public.get_contact_ledger_summary(v_request.to_user_id, v_recipient_contact_id);
  v_sender_records := coalesce((v_sender_summary->>'record_count')::integer, 0);
  v_recipient_records := coalesce((v_recipient_summary->>'record_count')::integer, 0);

  if v_sender_records > 0 and v_recipient_records > 0 then
    v_merge_key := public.friend_merge_key(v_request.from_user_id, v_request.to_user_id);

    delete from public.p2p_requests
    where type = 'friend_merge_choice'
      and status = 'pending'
      and coalesce(request_payload->>'merge_key', '') = v_merge_key;

    insert into public.p2p_requests (
      type,
      from_user_id,
      to_user_id,
      message,
      status,
      request_payload
    ) values
      (
        'friend_merge_choice',
        v_request.from_user_id,
        v_request.to_user_id,
        'Separate histories were found for this friend. Choose which history to keep before shared records go live.',
        'pending',
        jsonb_build_object(
          'merge_key', v_merge_key,
          'friend_request_id', v_request.id,
          'user_a_id', v_request.from_user_id,
          'user_a_name', v_sender_profile_name,
          'user_a_contact_id', v_sender_contact_id,
          'user_a_summary', v_sender_summary,
          'user_b_id', v_request.to_user_id,
          'user_b_name', v_recipient_profile_name,
          'user_b_contact_id', v_recipient_contact_id,
          'user_b_summary', v_recipient_summary
        )
      ),
      (
        'friend_merge_choice',
        v_request.to_user_id,
        v_request.from_user_id,
        'Separate histories were found for this friend. Choose which history to keep before shared records go live.',
        'pending',
        jsonb_build_object(
          'merge_key', v_merge_key,
          'friend_request_id', v_request.id,
          'user_a_id', v_request.from_user_id,
          'user_a_name', v_sender_profile_name,
          'user_a_contact_id', v_sender_contact_id,
          'user_a_summary', v_sender_summary,
          'user_b_id', v_request.to_user_id,
          'user_b_name', v_recipient_profile_name,
          'user_b_contact_id', v_recipient_contact_id,
          'user_b_summary', v_recipient_summary
        )
      );

    update public.p2p_requests
    set status = 'approved',
        updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'merge_required',
      'merge_key', v_merge_key,
      'user_a_name', v_sender_profile_name,
      'user_b_name', v_recipient_profile_name
    );
  end if;

  update public.contacts
  set target_user_id = v_request.to_user_id,
      link_status = 'accepted',
      name = coalesce(v_recipient_profile_name, v_sender_payload_name, name),
      email = coalesce(v_recipient_profile_email, v_sender_payload_email, email),
      phone = coalesce(v_recipient_profile_phone, v_sender_payload_phone, phone)
  where id = v_sender_contact_id;

  update public.contacts
  set target_user_id = v_request.from_user_id,
      link_status = 'accepted',
      name = coalesce(v_sender_profile_name, name),
      email = coalesce(v_sender_profile_email, email),
      phone = coalesce(v_sender_profile_phone, phone),
      notes = coalesce(notes, v_sender_notes),
      social_network = coalesce(social_network, v_sender_social)
  where id = v_recipient_contact_id;

  if v_sender_records > 0 and v_recipient_records = 0 then
    v_sync_result := public.sync_friend_ledger(
      v_request.from_user_id,
      v_sender_contact_id,
      v_request.to_user_id,
      v_recipient_contact_id,
      true
    );
  elsif v_recipient_records > 0 and v_sender_records = 0 then
    v_sync_result := public.sync_friend_ledger(
      v_request.to_user_id,
      v_recipient_contact_id,
      v_request.from_user_id,
      v_sender_contact_id,
      true
    );
  end if;

  update public.p2p_requests
  set status = 'approved',
      updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'status', 'approved',
    'synced_from_user_id',
      case
        when v_sender_records > 0 and v_recipient_records = 0 then v_request.from_user_id
        when v_recipient_records > 0 and v_sender_records = 0 then v_request.to_user_id
        else null
      end,
    'sync_result', v_sync_result
  );
end;
$$;

commit;
