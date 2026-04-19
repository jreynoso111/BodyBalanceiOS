begin;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists receipts_select_own on storage.objects;
drop policy if exists receipts_select_participants on storage.objects;
create policy receipts_select_participants
on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.loans l
      where l.evidence_url = name
        and l.deleted_at is null
        and (l.user_id = auth.uid() or l.target_user_id = auth.uid())
    )
  )
);

drop policy if exists receipts_insert_own on storage.objects;
create policy receipts_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_update_own on storage.objects;
create policy receipts_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_delete_own on storage.objects;
create policy receipts_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
