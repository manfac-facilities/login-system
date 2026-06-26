insert into storage.buckets (id, name, public) values ('checklist-fotos', 'checklist-fotos', false);
insert into storage.buckets (id, name, public) values ('sofia-anexos', 'sofia-anexos', false);

create policy "authenticated upload checklist" on storage.objects for insert to authenticated with check (bucket_id = 'checklist-fotos');
create policy "authenticated read checklist" on storage.objects for select to authenticated using (bucket_id = 'checklist-fotos');
create policy "authenticated upload anexos" on storage.objects for insert to authenticated with check (bucket_id = 'sofia-anexos');
create policy "authenticated read anexos" on storage.objects for select to authenticated using (bucket_id = 'sofia-anexos');
