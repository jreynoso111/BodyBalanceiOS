begin;

alter table public.profiles
  alter column role set default 'user';

update public.profiles
set role = 'user'
where role is null;

alter table public.profiles
  alter column role set not null;

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
  )
);

commit;;
