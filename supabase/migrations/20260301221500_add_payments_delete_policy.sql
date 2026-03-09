begin;

drop policy if exists payments_delete_participants on public.payments;
create policy payments_delete_participants on public.payments
for delete to authenticated
using (user_id = auth.uid() or target_user_id = auth.uid());

commit;
