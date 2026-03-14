begin;

alter table if exists public.contacts
  drop constraint if exists contacts_target_user_id_fkey;

alter table if exists public.contacts
  add constraint contacts_target_user_id_fkey
  foreign key (target_user_id) references public.profiles(id) on delete set null;

alter table if exists public.loans
  drop constraint if exists loans_target_user_id_fkey;

alter table if exists public.loans
  add constraint loans_target_user_id_fkey
  foreign key (target_user_id) references public.profiles(id) on delete set null;

alter table if exists public.payments
  drop constraint if exists payments_target_user_id_fkey;

alter table if exists public.payments
  add constraint payments_target_user_id_fkey
  foreign key (target_user_id) references public.profiles(id) on delete set null;

alter table if exists public.p2p_requests
  drop constraint if exists p2p_requests_from_user_id_fkey;

alter table if exists public.p2p_requests
  add constraint p2p_requests_from_user_id_fkey
  foreign key (from_user_id) references public.profiles(id) on delete cascade;

alter table if exists public.p2p_requests
  drop constraint if exists p2p_requests_to_user_id_fkey;

alter table if exists public.p2p_requests
  add constraint p2p_requests_to_user_id_fkey
  foreign key (to_user_id) references public.profiles(id) on delete cascade;

alter table if exists public.payment_history
  drop constraint if exists payment_history_changed_by_fkey;

alter table if exists public.payment_history
  add constraint payment_history_changed_by_fkey
  foreign key (changed_by) references auth.users(id) on delete set null;

commit;
