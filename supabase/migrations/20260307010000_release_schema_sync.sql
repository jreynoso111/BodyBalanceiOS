begin;

alter table if exists public.profiles
  add column if not exists default_language text not null default 'en';

update public.profiles
set default_language = case
  when lower(coalesce(default_language, '')) in ('en', 'es', 'fr', 'it') then lower(default_language)
  else 'en'
end
where default_language is null
   or lower(coalesce(default_language, '')) not in ('en', 'es', 'fr', 'it');

alter table if exists public.profiles
  add column if not exists push_token text;

alter table if exists public.profiles
  add column if not exists avatar_url text;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  reminder_enabled boolean not null default false,
  biometric_enabled boolean not null default false,
  marketing_enabled boolean not null default false,
  preferred_currencies text[] not null default array['USD'],
  updated_at timestamptz not null default now()
);

alter table if exists public.user_preferences
  add column if not exists preferred_currencies text[] not null default array['USD'];

alter table if exists public.user_preferences
  alter column push_enabled set default false;

alter table if exists public.user_preferences
  alter column reminder_enabled set default false;

update public.user_preferences
set preferred_currencies = array['USD']
where preferred_currencies is null
   or cardinality(preferred_currencies) = 0;

alter table if exists public.user_preferences enable row level security;

drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_preferences_insert_self on public.user_preferences;
create policy user_preferences_insert_self
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_preferences_update_self on public.user_preferences;
create policy user_preferences_update_self
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_preferences_delete_self on public.user_preferences;
create policy user_preferences_delete_self
on public.user_preferences
for delete
to authenticated
using (user_id = auth.uid());

alter table if exists public.p2p_requests
  add column if not exists request_payload jsonb;

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
