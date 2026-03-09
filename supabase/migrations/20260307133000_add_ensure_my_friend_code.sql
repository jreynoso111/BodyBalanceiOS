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
