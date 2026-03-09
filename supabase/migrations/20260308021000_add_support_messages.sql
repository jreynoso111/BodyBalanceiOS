begin;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'phone', 'other')),
  subject text null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_user_id_idx on public.support_messages (user_id, created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own
on public.support_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists support_messages_insert_own on public.support_messages;
create policy support_messages_insert_own
on public.support_messages
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists support_messages_admin_select on public.support_messages;
create policy support_messages_admin_select
on public.support_messages
for select
to authenticated
using (public.is_admin());

drop policy if exists support_messages_admin_update on public.support_messages;
create policy support_messages_admin_update
on public.support_messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists trg_audit_support_messages on public.support_messages;
create trigger trg_audit_support_messages
after insert or update or delete on public.support_messages
for each row execute function public.log_audit_event();

commit;
