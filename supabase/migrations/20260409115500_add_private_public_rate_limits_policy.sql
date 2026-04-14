begin;

do $$
begin
  if exists (
    select 1
    from pg_namespace n
    join pg_class c on c.relnamespace = n.oid
    where n.nspname = 'private'
      and c.relname = 'public_rate_limits'
      and c.relkind = 'r'
  ) then
    execute 'drop policy if exists public_rate_limits_no_client_access on private.public_rate_limits';
    execute $policy$
      create policy public_rate_limits_no_client_access
      on private.public_rate_limits
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false)
    $policy$;
  end if;
end;
$$;

commit;
