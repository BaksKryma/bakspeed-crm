-- 0015: Storage buckets

insert into storage.buckets (id, name, public) values
  ('orders-pdf', 'orders-pdf', false),
  ('documents',  'documents',  false),
  ('static',     'static',     false)
on conflict (id) do nothing;

-- Policies: authenticated managers can read/write `documents` and `orders-pdf`.
create policy "managers_read_documents" on storage.objects for select to authenticated
  using (bucket_id in ('documents','orders-pdf','static') and public.is_authenticated_manager());
create policy "managers_write_documents" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents','orders-pdf') and public.is_authenticated_manager());
create policy "managers_update_documents" on storage.objects for update to authenticated
  using (bucket_id in ('documents','orders-pdf') and public.is_authenticated_manager());
create policy "managers_delete_documents" on storage.objects for delete to authenticated
  using (bucket_id in ('documents','orders-pdf') and public.current_user_role() = 'owner');

-- Anon: driver webview may GET driver briefs
create policy "anon_read_driver_briefs" on storage.objects for select to anon
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'driver-briefs');
