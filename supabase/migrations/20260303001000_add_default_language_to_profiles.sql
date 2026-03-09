begin;

alter table public.profiles
add column if not exists default_language text not null default 'en';

update public.profiles
set default_language = case
  when lower(coalesce(default_language, '')) in ('en', 'es', 'fr', 'it') then lower(default_language)
  else 'en'
end;

commit;
