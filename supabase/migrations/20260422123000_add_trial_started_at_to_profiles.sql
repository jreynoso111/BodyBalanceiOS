alter table public.profiles
add column if not exists trial_started_at timestamp with time zone;

update public.profiles as p
set trial_started_at = coalesce(p.trial_started_at, u.created_at, now())
from auth.users as u
where u.id = p.id
  and p.trial_started_at is null;

update public.profiles
set trial_started_at = now()
where trial_started_at is null;

alter table public.profiles
alter column trial_started_at set default now();

alter table public.profiles
alter column trial_started_at set not null;
