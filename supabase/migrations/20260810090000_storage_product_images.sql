-- Product images move to Supabase Storage: uploads require the owner's
-- authenticated session (no publicly abusable unsigned preset), public
-- read for the site. Public URLs are stored in items.images exactly like
-- the Cloudinary URLs, so the front end is origin-agnostic.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB hard ceiling; client compresses to ~400KB before upload
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Owner upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Owner update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "Owner delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
