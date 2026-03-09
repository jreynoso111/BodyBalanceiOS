begin;

alter table if exists public.p2p_requests
add column if not exists request_payload jsonb;

commit;
