begin;

drop policy if exists "Users can update their own profile" on public.profiles;
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
  and plan_tier = (
    select p.plan_tier
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.admin_set_profile_plan_tier(p_user_id uuid, p_plan_tier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plan text;
  updated_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  normalized_plan := case
    when lower(coalesce(p_plan_tier, '')) = 'premium' then 'premium'
    else 'free'
  end;

  update public.profiles
  set plan_tier = normalized_plan,
      updated_at = now()
  where id = p_user_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    raise exception 'Profile not found';
  end if;

  return normalized_plan;
end;
$$;

revoke all on function public.admin_set_profile_plan_tier(uuid, text) from public;
grant execute on function public.admin_set_profile_plan_tier(uuid, text) to authenticated;

commit;
