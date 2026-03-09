-- Run this script in Supabase SQL Editor.
-- Goal: enforce row-level security and avoid exposing cross-user data.

begin;

-- 1) Core tables: enable RLS
alter table if exists public.contacts enable row level security;
alter table if exists public.loans enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.p2p_requests enable row level security;
alter table if exists public.payment_history enable row level security;
alter table if exists public.profiles enable row level security;

-- 2) Contacts (owner only)
drop policy if exists contacts_select_owner on public.contacts;
create policy contacts_select_owner on public.contacts
for select to authenticated
using (user_id = auth.uid());

drop policy if exists contacts_insert_owner on public.contacts;
create policy contacts_insert_owner on public.contacts
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists contacts_update_owner on public.contacts;
create policy contacts_update_owner on public.contacts
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists contacts_delete_owner on public.contacts;
create policy contacts_delete_owner on public.contacts
for delete to authenticated
using (user_id = auth.uid());

-- 3) Loans (creator and participant can read; creator inserts; both can update status/validation)
drop policy if exists loans_select_participants on public.loans;
create policy loans_select_participants on public.loans
for select to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists loans_insert_owner on public.loans;
create policy loans_insert_owner on public.loans
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists loans_update_participants on public.loans;
create policy loans_update_participants on public.loans
for update to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid())
with check (user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists loans_delete_owner on public.loans;
create policy loans_delete_owner on public.loans
for delete to authenticated
using (user_id = auth.uid());

-- 4) Payments
drop policy if exists payments_select_participants on public.payments;
create policy payments_select_participants on public.payments
for select to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists payments_insert_owner on public.payments;
create policy payments_insert_owner on public.payments
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists payments_update_participants on public.payments;
create policy payments_update_participants on public.payments
for update to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid())
with check (user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists payments_delete_participants on public.payments;
create policy payments_delete_participants on public.payments
for delete to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid());

-- 5) P2P requests
drop policy if exists p2p_requests_select_participants on public.p2p_requests;
create policy p2p_requests_select_participants on public.p2p_requests
for select to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists p2p_requests_insert_sender on public.p2p_requests;
create policy p2p_requests_insert_sender on public.p2p_requests
for insert to authenticated
with check (from_user_id = auth.uid());

drop policy if exists p2p_requests_update_participants on public.p2p_requests;
create policy p2p_requests_update_participants on public.p2p_requests
for update to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid())
with check (from_user_id = auth.uid() or to_user_id = auth.uid());

-- 6) Payment history
drop policy if exists payment_history_select_participants on public.payment_history;
create policy payment_history_select_participants on public.payment_history
for select to authenticated
using (
  changed_by = auth.uid()
  or exists (
    select 1
    from public.payments p
    where p.id = payment_history.payment_id
      and (p.user_id = auth.uid() or p.target_user_id = auth.uid())
  )
);

drop policy if exists payment_history_insert_actor on public.payment_history;
create policy payment_history_insert_actor on public.payment_history
for insert to authenticated
with check (changed_by = auth.uid());

-- 7) Profiles: self only + secure lookup function for contact-linking
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
  )
);

create or replace function public.generate_friend_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (
      select 1
      from public.profiles p
      where p.friend_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.ensure_my_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, friend_code)
  values (auth.uid(), public.generate_friend_code())
  on conflict (id) do update
    set friend_code = coalesce(nullif(trim(public.profiles.friend_code), ''), public.generate_friend_code());

  select p.friend_code
    into next_code
  from public.profiles p
  where p.id = auth.uid();

  return next_code;
end;
$$;

revoke all on function public.ensure_my_friend_code() from public;
grant execute on function public.ensure_my_friend_code() to authenticated;

create or replace function public.find_profile_match(p_email text default null, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_profile_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.id
    into matched_profile_id
  from public.profiles p
  where (
      p_email is not null
      and p_email <> ''
      and lower(p.email) = lower(trim(p_email))
    )
    or (
      p_phone is not null
      and p_phone <> ''
      and p.phone = trim(p_phone)
    )
  limit 1;

  return matched_profile_id;
end;
$$;

revoke all on function public.find_profile_match(text, text) from public;
grant execute on function public.find_profile_match(text, text) to authenticated;

create or replace function public.find_profile_by_friend_code(p_friend_code text)
returns table(id uuid, full_name text, email text)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), p.email, 'Friend') as full_name,
    p.email
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and upper(trim(coalesce(p.friend_code, ''))) = upper(trim(coalesce(p_friend_code, '')))
  limit 1;
$$;

revoke all on function public.find_profile_by_friend_code(text) from public;
grant execute on function public.find_profile_by_friend_code(text) to authenticated;

-- 8) Storage bucket policies for receipts: path must start with "<auth.uid()>/"
drop policy if exists receipts_select_own on storage.objects;
create policy receipts_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_insert_own on storage.objects;
create policy receipts_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_update_own on storage.objects;
create policy receipts_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_delete_own on storage.objects;
create policy receipts_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 9) Storage bucket policies for avatars: authenticated users can upload only to their own folder
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists avatars_select_authenticated on storage.objects;
create policy avatars_select_authenticated on storage.objects
for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
