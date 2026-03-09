alter table public.profiles
  add column if not exists plan_tier text;

update public.profiles
set plan_tier = case
  when lower(coalesce(plan_tier, '')) = 'premium' then 'premium'
  else 'free'
end
where plan_tier is null
   or lower(coalesce(plan_tier, '')) not in ('free', 'premium');

alter table public.profiles
  alter column plan_tier set default 'free';

alter table public.profiles
  alter column plan_tier set not null;
