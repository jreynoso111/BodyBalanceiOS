alter table if exists public.user_preferences
  alter column push_enabled set default false;

alter table if exists public.user_preferences
  alter column reminder_enabled set default false;
