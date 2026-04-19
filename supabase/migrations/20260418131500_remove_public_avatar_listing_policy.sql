begin;

drop policy if exists avatars_select_authenticated on storage.objects;

commit;
