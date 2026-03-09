begin;

alter table public.user_preferences
add column if not exists preferred_currencies text[] not null default array['USD'];

update public.user_preferences
set preferred_currencies = array['USD']
where preferred_currencies is null
   or cardinality(preferred_currencies) = 0;

commit;
