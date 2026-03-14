begin;

create or replace function public.admin_set_profile_plan_tier(p_user_id uuid, p_plan_tier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  raise exception 'Manual membership changes are disabled. Premium is managed only through verified billing and referral flows.';
end;
$$;

revoke all on function public.admin_set_profile_plan_tier(uuid, text) from public;
grant execute on function public.admin_set_profile_plan_tier(uuid, text) to authenticated;

commit;
