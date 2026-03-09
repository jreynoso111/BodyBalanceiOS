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

alter table public.profiles
  add column if not exists friend_code text;

update public.profiles
set friend_code = public.generate_friend_code()
where coalesce(trim(friend_code), '') = '';

alter table public.profiles
  alter column friend_code set default public.generate_friend_code();

alter table public.profiles
  alter column friend_code set not null;

create unique index if not exists profiles_friend_code_key
  on public.profiles(friend_code);

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
