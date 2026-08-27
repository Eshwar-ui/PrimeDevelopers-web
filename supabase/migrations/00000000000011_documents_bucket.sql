-- ── storage: public "documents" bucket ──────────────────────────────────
-- Property flyers and brochures (.pdf). Kept out of "images" because the two
-- differ in the way that matters here: an image is embedded in a page, a
-- document is downloaded and mailed as an attachment, and only the latter
-- needs a size ceiling large enough for a print-resolution A4 flyer.
--
-- This is what the brochure request flow attaches. Without a bucket to put a
-- flyer in there is no flyer to attach, and the endpoint can only record the
-- lead and tell the visitor a person will follow up.
--
-- Public read is deliberate, matching images and models — a flyer is a
-- marketing asset served straight to visitors, and the mail service fetches
-- it by URL. Write stays authenticated.
--
-- PDF only. The bucket is public and its contents are linked from the site,
-- so the same reasoning that keeps SVG out of the images bucket applies: any
-- format the browser will execute is an XSS vector wearing a document's
-- clothes. 10 MB because a flyer that will not fit is a flyer nobody can
-- email — SES caps a message at 40 MB, and base64 inflates by a third.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "documents_public_read" on storage.objects
  for select using (bucket_id = 'documents');

create policy "documents_admin_write" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_admin_update" on storage.objects
  for update using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_admin_delete" on storage.objects
  for delete using (bucket_id = 'documents' and auth.role() = 'authenticated');
