begin;

alter table if exists public.contacts
  add column if not exists link_status text not null default 'private';

update public.contacts
set link_status = case
  when target_user_id is null then 'private'
  when coalesce(trim(link_status), '') in ('pending', 'accepted') then link_status
  else 'accepted'
end;

alter table if exists public.contacts
  drop constraint if exists contacts_link_status_check;

alter table if exists public.contacts
  add constraint contacts_link_status_check
  check (link_status in ('private', 'pending', 'accepted'));

alter table if exists public.p2p_requests
  drop constraint if exists p2p_requests_type_check;

alter table if exists public.p2p_requests
  add constraint p2p_requests_type_check
  check (type in ('loan_validation', 'payment_validation', 'debt_reduction', 'friend_request'));

commit;
