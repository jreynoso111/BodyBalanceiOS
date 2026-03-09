create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_loan_status_on_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_paid decimal(15, 2);
  original_amount decimal(15, 2);
begin
  select amount into original_amount
  from public.loans
  where id = new.loan_id;

  select coalesce(sum(amount), 0) into total_paid
  from public.payments
  where loan_id = new.loan_id;

  if total_paid >= original_amount then
    update public.loans
    set status = 'paid'
    where id = new.loan_id;
  elsif total_paid > 0 then
    update public.loans
    set status = 'partial'
    where id = new.loan_id;
  end if;

  return new;
end;
$$;
