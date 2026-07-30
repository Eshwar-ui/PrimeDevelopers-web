-- ── storage: public "models" bucket ─────────────────────────────────────
-- 3D building models (.glb). Kept separate from "images" because the size
-- ceiling and allowed MIME types are different: a model is two orders of
-- magnitude larger than a photo, and only glTF-binary is ever accepted.
--
-- Public read is deliberate — these are marketing assets, served straight to
-- visitors. Write stays authenticated, matching the images bucket.
--
-- The 8 MB limit is enforced here as well as in the admin UI. Client-side
-- validation is a courtesy that produces a good error message; this is the
-- control that actually holds.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'models',
  'models',
  true,
  8388608,
  array['model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "models_public_read" on storage.objects
  for select using (bucket_id = 'models');

create policy "models_admin_write" on storage.objects
  for insert with check (bucket_id = 'models' and auth.role() = 'authenticated');

create policy "models_admin_update" on storage.objects
  for update using (bucket_id = 'models' and auth.role() = 'authenticated');

create policy "models_admin_delete" on storage.objects
  for delete using (bucket_id = 'models' and auth.role() = 'authenticated');
