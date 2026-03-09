alter table public.p2p_requests
drop constraint if exists p2p_requests_type_check;

alter table public.p2p_requests
add constraint p2p_requests_type_check
check (
  type = any (
    array[
      'loan_validation'::text,
      'payment_validation'::text,
      'payment_notice'::text,
      'debt_reduction'::text,
      'friend_request'::text
    ]
  )
);
