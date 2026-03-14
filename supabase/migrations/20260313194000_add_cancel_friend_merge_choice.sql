begin;

create or replace function public.cancel_friend_merge_choice(
  p_request_id uuid
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
  v_friend_request_id uuid;
  v_merge_key text;
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
    v_friend_request_id := nullif(trim(coalesce(v_request.request_payload->>'friend_request_id', '')), '')::uuid;
  exception
    when others then
      raise exception 'This merge request is missing contact details';
  end;

  v_merge_key := coalesce(v_request.request_payload->>'merge_key', public.friend_merge_key(v_user_a_id, v_user_b_id));

  update public.contacts
  set target_user_id = null,
      link_status = 'private'
  where id in (v_user_a_contact_id, v_user_b_contact_id);

  update public.p2p_requests
  set status = 'rejected',
      updated_at = now(),
      request_payload = coalesce(request_payload, '{}'::jsonb)
        || jsonb_build_object(
          'cancelled_by_user_id', auth.uid(),
          'cancelled_at', now()
        )
  where type = 'friend_merge_choice'
    and status = 'pending'
    and coalesce(request_payload->>'merge_key', '') = v_merge_key;

  if v_friend_request_id is not null then
    update public.p2p_requests
    set status = 'rejected',
        updated_at = now(),
        request_payload = coalesce(request_payload, '{}'::jsonb)
          || jsonb_build_object(
            'merge_cancelled_by_user_id', auth.uid(),
            'merge_cancelled_at', now()
          )
    where id = v_friend_request_id;
  end if;

  return jsonb_build_object(
    'status', 'cancelled',
    'user_a_id', v_user_a_id,
    'user_b_id', v_user_b_id
  );
end;
$$;

revoke all on function public.cancel_friend_merge_choice(uuid) from public;
grant execute on function public.cancel_friend_merge_choice(uuid) to authenticated;

commit;
