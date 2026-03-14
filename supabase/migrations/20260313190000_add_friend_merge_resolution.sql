begin;

alter table if exists public.p2p_requests
  drop constraint if exists p2p_requests_type_check;

alter table if exists public.p2p_requests
  add constraint p2p_requests_type_check
  check (
    type in (
      'loan_validation',
      'payment_validation',
      'payment_notice',
      'debt_reduction',
      'friend_request',
      'friend_merge_choice',
      'referral_reward'
    )
  );

create or replace function public.friend_merge_key(
  p_user_a uuid,
  p_user_b uuid
)
returns text
language plpgsql
immutable
strict
as $$
begin
  if p_user_a::text <= p_user_b::text then
    return p_user_a::text || ':' || p_user_b::text;
  end if;

  return p_user_b::text || ':' || p_user_a::text;
end;
$$;

create or replace function public.get_contact_ledger_summary(
  p_owner_user_id uuid,
  p_contact_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with selected_loans as (
    select
      l.id,
      l.amount,
      l.type,
      l.status,
      l.category
    from public.loans l
    where l.user_id = p_owner_user_id
      and l.contact_id = p_contact_id
      and l.deleted_at is null
  ),
  payment_totals as (
    select
      p.loan_id,
      sum(
        case
          when coalesce(p.payment_method, 'money') = 'money' then coalesce(p.amount, 0)
          else 0
        end
      ) as money_paid
    from public.payments p
    join selected_loans l on l.id = p.loan_id
    group by p.loan_id
  ),
  payment_counts as (
    select count(*)::integer as payment_count
    from public.payments p
    join selected_loans l on l.id = p.loan_id
  )
  select jsonb_build_object(
    'record_count', coalesce(count(l.id), 0)::integer,
    'active_record_count', coalesce(count(*) filter (where l.status in ('active', 'partial', 'overdue')), 0)::integer,
    'payment_count', coalesce((select payment_count from payment_counts), 0),
    'open_money_total',
      coalesce(
        sum(
          case
            when l.category = 'money' and l.status in ('active', 'partial', 'overdue') then
              case
                when l.type = 'lent' then greatest(coalesce(l.amount, 0) - coalesce(pt.money_paid, 0), 0)
                else -greatest(coalesce(l.amount, 0) - coalesce(pt.money_paid, 0), 0)
              end
            else 0
          end
        ),
        0
      ),
    'open_item_total',
      coalesce(
        sum(
          case
            when l.category = 'item' and l.status in ('active', 'partial', 'overdue') then
              case
                when l.type = 'lent' then 1
                else -1
              end
            else 0
          end
        ),
        0
      )
  )
  from selected_loans l
  left join payment_totals pt on pt.loan_id = l.id;
$$;

create or replace function public.sync_friend_ledger(
  p_source_user_id uuid,
  p_source_contact_id uuid,
  p_target_user_id uuid,
  p_target_contact_id uuid,
  p_replace_target boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_loan public.loans%rowtype;
  v_source_payment public.payments%rowtype;
  v_target_loan_id uuid;
  v_created_loans integer := 0;
  v_created_payments integer := 0;
begin
  if p_source_user_id is null
     or p_source_contact_id is null
     or p_target_user_id is null
     or p_target_contact_id is null then
    raise exception 'Missing friend ledger sync arguments';
  end if;

  if p_replace_target then
    delete from public.loans
    where user_id = p_target_user_id
      and contact_id = p_target_contact_id
      and deleted_at is null;
  end if;

  update public.loans
  set target_user_id = p_target_user_id
  where user_id = p_source_user_id
    and contact_id = p_source_contact_id
    and deleted_at is null;

  update public.payments
  set target_user_id = p_target_user_id
  where user_id = p_source_user_id
    and loan_id in (
      select l.id
      from public.loans l
      where l.user_id = p_source_user_id
        and l.contact_id = p_source_contact_id
        and l.deleted_at is null
    );

  for v_source_loan in
    select *
    from public.loans
    where user_id = p_source_user_id
      and contact_id = p_source_contact_id
      and deleted_at is null
    order by created_at asc, id asc
  loop
    insert into public.loans (
      user_id,
      contact_id,
      target_user_id,
      amount,
      currency,
      category,
      item_name,
      type,
      description,
      due_date,
      status,
      validation_status,
      evidence_url,
      reminder_frequency,
      reminder_interval,
      created_at,
      updated_at
    ) values (
      p_target_user_id,
      p_target_contact_id,
      p_source_user_id,
      v_source_loan.amount,
      v_source_loan.currency,
      v_source_loan.category,
      v_source_loan.item_name,
      case when v_source_loan.type = 'lent' then 'borrowed'::public.loan_type else 'lent'::public.loan_type end,
      v_source_loan.description,
      v_source_loan.due_date,
      v_source_loan.status,
      coalesce(v_source_loan.validation_status, 'approved'),
      v_source_loan.evidence_url,
      'none',
      1,
      coalesce(v_source_loan.created_at, now()),
      coalesce(v_source_loan.updated_at, v_source_loan.created_at, now())
    )
    returning id into v_target_loan_id;

    v_created_loans := v_created_loans + 1;

    for v_source_payment in
      select *
      from public.payments
      where loan_id = v_source_loan.id
      order by payment_date asc, id asc
    loop
      insert into public.payments (
        loan_id,
        user_id,
        target_user_id,
        amount,
        payment_date,
        note,
        evidence_url,
        payment_method,
        returned_item_name,
        validation_status
      ) values (
        v_target_loan_id,
        p_target_user_id,
        p_source_user_id,
        v_source_payment.amount,
        v_source_payment.payment_date,
        v_source_payment.note,
        v_source_payment.evidence_url,
        coalesce(v_source_payment.payment_method, 'money'),
        v_source_payment.returned_item_name,
        coalesce(v_source_payment.validation_status, 'approved')
      );

      v_created_payments := v_created_payments + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'loan_count', v_created_loans,
    'payment_count', v_created_payments
  );
end;
$$;

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
      order by c.created_at asc
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
    c.created_at asc
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

create or replace function public.resolve_friend_merge_choice(
  p_request_id uuid,
  p_keep_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.p2p_requests%rowtype;
  v_user_a_id uuid;
  v_user_b_id uuid;
  v_user_a_contact_id uuid;
  v_user_b_contact_id uuid;
  v_merge_key text;
  v_keep_contact_id uuid;
  v_discard_user_id uuid;
  v_discard_contact_id uuid;
  v_sync_result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_request
  from public.p2p_requests
  where id = p_request_id
    and type = 'friend_merge_choice'
    and to_user_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Friend merge choice not found or already resolved';
  end if;

  begin
    v_user_a_id := nullif(trim(coalesce(v_request.request_payload->>'user_a_id', '')), '')::uuid;
    v_user_b_id := nullif(trim(coalesce(v_request.request_payload->>'user_b_id', '')), '')::uuid;
    v_user_a_contact_id := nullif(trim(coalesce(v_request.request_payload->>'user_a_contact_id', '')), '')::uuid;
    v_user_b_contact_id := nullif(trim(coalesce(v_request.request_payload->>'user_b_contact_id', '')), '')::uuid;
  exception
    when others then
      raise exception 'This merge request is missing contact details';
  end;

  v_merge_key := coalesce(v_request.request_payload->>'merge_key', public.friend_merge_key(v_user_a_id, v_user_b_id));

  if p_keep_user_id not in (v_user_a_id, v_user_b_id) then
    raise exception 'Invalid keep user selection';
  end if;

  if p_keep_user_id = v_user_a_id then
    v_keep_contact_id := v_user_a_contact_id;
    v_discard_user_id := v_user_b_id;
    v_discard_contact_id := v_user_b_contact_id;
  else
    v_keep_contact_id := v_user_b_contact_id;
    v_discard_user_id := v_user_a_id;
    v_discard_contact_id := v_user_a_contact_id;
  end if;

  update public.contacts
  set target_user_id = case when id = v_user_a_contact_id then v_user_b_id else v_user_a_id end,
      link_status = 'accepted'
  where id in (v_user_a_contact_id, v_user_b_contact_id);

  if p_keep_user_id = v_user_a_id then
    v_sync_result := public.sync_friend_ledger(
      v_user_a_id,
      v_user_a_contact_id,
      v_user_b_id,
      v_user_b_contact_id,
      true
    );
  else
    v_sync_result := public.sync_friend_ledger(
      v_user_b_id,
      v_user_b_contact_id,
      v_user_a_id,
      v_user_a_contact_id,
      true
    );
  end if;

  update public.p2p_requests
  set status = 'approved',
      updated_at = now(),
      request_payload = coalesce(request_payload, '{}'::jsonb)
        || jsonb_build_object(
          'resolved_by_user_id', auth.uid(),
          'kept_user_id', p_keep_user_id,
          'deleted_user_id', v_discard_user_id
        )
  where type = 'friend_merge_choice'
    and status = 'pending'
    and coalesce(request_payload->>'merge_key', '') = v_merge_key;

  return jsonb_build_object(
    'status', 'approved',
    'kept_user_id', p_keep_user_id,
    'deleted_user_id', v_discard_user_id,
    'sync_result', v_sync_result
  );
end;
$$;

revoke all on function public.friend_merge_key(uuid, uuid) from public;
grant execute on function public.friend_merge_key(uuid, uuid) to authenticated;

revoke all on function public.get_contact_ledger_summary(uuid, uuid) from public;
grant execute on function public.get_contact_ledger_summary(uuid, uuid) to authenticated;

revoke all on function public.sync_friend_ledger(uuid, uuid, uuid, uuid, boolean) from public;
grant execute on function public.sync_friend_ledger(uuid, uuid, uuid, uuid, boolean) to authenticated;

revoke all on function public.resolve_friend_request_v2(uuid, text) from public;
grant execute on function public.resolve_friend_request_v2(uuid, text) to authenticated;

revoke all on function public.resolve_friend_merge_choice(uuid, uuid) from public;
grant execute on function public.resolve_friend_merge_choice(uuid, uuid) to authenticated;

commit;
