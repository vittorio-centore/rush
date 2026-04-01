insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-assets',
  'profile-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Users can upload their own profile assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own profile assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own profile assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public can read profile assets"
on storage.objects
for select
to public
using (bucket_id = 'profile-assets');
