begin;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  reminder_enabled boolean not null default true,
  biometric_enabled boolean not null default false,
  marketing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists user_preferences_updated_at_idx on public.user_preferences (updated_at desc);

alter table public.user_preferences enable row level security;

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

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'log_audit_event'
  ) then
    execute 'drop trigger if exists trg_audit_user_preferences on public.user_preferences';
    execute 'create trigger trg_audit_user_preferences after insert or update or delete on public.user_preferences for each row execute function public.log_audit_event()';
  end if;
end
$$;

commit;;
