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
      'loan_notice'::text,
      'debt_reduction'::text,
      'friend_request'::text,
      'referral_reward'::text
    ]
  )
);

create or replace function public.create_linked_loan(
  p_contact_id uuid,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_item_name text,
  p_type text,
  p_description text,
  p_due_date date,
  p_evidence_url text,
  p_reminder_frequency text,
  p_reminder_interval integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_source_contact public.contacts%rowtype;
  v_counterpart_contact public.contacts%rowtype;
  v_current_loan public.loans%rowtype;
  v_counterpart_loan public.loans%rowtype;
  v_actor_profile public.profiles%rowtype;
  v_normalized_type public.loan_type;
  v_counterpart_type public.loan_type;
  v_normalized_category text;
  v_amount numeric;
  v_currency text;
  v_due_date date;
  v_reminder_frequency text;
  v_reminder_interval integer;
  v_sender_name text;
  v_message text;
begin
  if v_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_source_contact
  from public.contacts
  where id = p_contact_id
    and user_id = v_actor_user_id
    and deleted_at is null
    and link_status = 'accepted'
    and target_user_id is not null
  limit 1;

  if not found then
    raise exception 'Linked contact not found';
  end if;

  select *
  into v_counterpart_contact
  from public.contacts
  where user_id = v_source_contact.target_user_id
    and target_user_id = v_actor_user_id
    and deleted_at is null
    and link_status = 'accepted'
  order by id asc
  limit 1;

  if not found then
    raise exception 'Linked counterpart contact not found';
  end if;

  select *
  into v_actor_profile
  from public.profiles
  where id = v_actor_user_id
  limit 1;

  v_sender_name := coalesce(
    nullif(trim(coalesce(v_actor_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_source_contact.name, '')), ''),
    nullif(trim(coalesce(v_actor_profile.email, '')), ''),
    'Someone'
  );

  v_normalized_category := case
    when lower(coalesce(p_category, 'money')) = 'item' then 'item'
    else 'money'
  end;

  v_normalized_type := case
    when lower(coalesce(p_type, 'lent')) = 'borrowed' then 'borrowed'::public.loan_type
    else 'lent'::public.loan_type
  end;

  v_counterpart_type := case
    when v_normalized_type = 'lent' then 'borrowed'::public.loan_type
    else 'lent'::public.loan_type
  end;

  v_amount := case
    when v_normalized_category = 'money' then p_amount
    else greatest(coalesce(p_amount, 1), 1)
  end;

  if v_normalized_category = 'money' and (v_amount is null or v_amount <= 0) then
    raise exception 'Amount must be greater than zero';
  end if;

  v_currency := case
    when v_normalized_category = 'money' then nullif(trim(coalesce(p_currency, '')), '')
    else coalesce(nullif(trim(coalesce(p_currency, '')), ''), 'USD')
  end;

  if v_currency is null then
    v_currency := 'USD';
  end if;

  v_due_date := p_due_date;
  v_reminder_frequency := nullif(trim(coalesce(p_reminder_frequency, '')), '');
  v_reminder_interval := greatest(coalesce(p_reminder_interval, 1), 1);

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
    reminder_interval
  ) values (
    v_actor_user_id,
    v_source_contact.id,
    v_source_contact.target_user_id,
    v_amount,
    v_currency,
    v_normalized_category,
    nullif(trim(coalesce(p_item_name, '')), ''),
    v_normalized_type,
    nullif(trim(coalesce(p_description, '')), ''),
    v_due_date,
    'active',
    'approved',
    nullif(trim(coalesce(p_evidence_url, '')), ''),
    coalesce(v_reminder_frequency, 'none'),
    v_reminder_interval
  )
  returning * into v_current_loan;

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
    reminder_interval
  ) values (
    v_source_contact.target_user_id,
    v_counterpart_contact.id,
    v_actor_user_id,
    v_amount,
    v_currency,
    v_normalized_category,
    nullif(trim(coalesce(p_item_name, '')), ''),
    v_counterpart_type,
    nullif(trim(coalesce(p_description, '')), ''),
    v_due_date,
    'active',
    'approved',
    nullif(trim(coalesce(p_evidence_url, '')), ''),
    'none',
    1
  )
  returning * into v_counterpart_loan;

  v_message := case
    when v_normalized_category = 'item' then
      format(
        '%s added a shared item record for %s.',
        v_sender_name,
        coalesce(nullif(trim(coalesce(p_item_name, '')), ''), 'an item')
      )
    when v_normalized_type = 'lent' then
      format(
        '%s recorded that they lent you %s %s.',
        v_sender_name,
        coalesce(v_currency, 'USD'),
        trim(to_char(v_amount, 'FM999999999990.00'))
      )
    else
      format(
        '%s recorded that you lent them %s %s.',
        v_sender_name,
        coalesce(v_currency, 'USD'),
        trim(to_char(v_amount, 'FM999999999990.00'))
      )
  end;

  insert into public.p2p_requests (
    type,
    loan_id,
    from_user_id,
    to_user_id,
    message,
    request_payload,
    status,
    updated_at
  ) values (
    'loan_notice',
    v_counterpart_loan.id,
    v_actor_user_id,
    v_source_contact.target_user_id,
    v_message,
    jsonb_build_object(
      'sender_name', v_sender_name,
      'sender_email', v_actor_profile.email,
      'counterpart_loan_id', v_current_loan.id,
      'category', v_normalized_category,
      'type', v_normalized_type,
      'amount', v_amount,
      'currency', v_currency,
      'item_name', nullif(trim(coalesce(p_item_name, '')), '')
    ),
    'approved',
    now()
  );

  return jsonb_build_object(
    'loan_id', v_current_loan.id,
    'counterpart_loan_id', v_counterpart_loan.id
  );
end;
$$;

revoke all on function public.create_linked_loan(uuid, numeric, text, text, text, text, text, date, text, text, integer) from public;
grant execute on function public.create_linked_loan(uuid, numeric, text, text, text, text, text, date, text, text, integer) to authenticated;
