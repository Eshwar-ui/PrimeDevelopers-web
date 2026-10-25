-- ── Retire the Supabase-Auth admin policies ──────────────────────────────
-- Migrations 6, 7 and 11 made "any signed-in Supabase user" the CMS admin:
-- `auth.role() = 'authenticated'` could write content, properties and news,
-- read, change and delete every lead, and write to the storage buckets. That
-- was right while the browser talked to Supabase directly with the admin's
-- Supabase session.
--
-- It stopped being true in migration 8: admin login moved to the API's own
-- website_admin_users, the API reaches Postgres as the table owner (which RLS
-- does not apply to) and Storage with the service-role key, and the browser
-- holds no Supabase credential at all. Nothing legitimate has used these
-- policies since — but they still let anyone who self-registers on this
-- project (if sign-up is enabled) and holds the anon key act as an admin. The
-- same goes for the anonymous lead inserts, which bypassed every limit the API
-- puts on enquiries.
--
-- Kept: the public read policies (published content only — exactly what the
-- API serves anyway) and RLS itself, which with no write policies left denies
-- every write from anon and authenticated.
--
-- Found by docs/system-audit-2026-10-24.md. Applying it changes nothing the
-- Render API does.

-- Tables: every admin_* policy and the anonymous lead inserts.
drop policy if exists "content_admin_write"                  on public.content;
drop policy if exists "properties_admin_read_all"            on public.properties;
drop policy if exists "properties_admin_write"               on public.properties;
drop policy if exists "properties_admin_update"              on public.properties;
drop policy if exists "properties_admin_delete"              on public.properties;
drop policy if exists "news_admin_read_all"                  on public.news;
drop policy if exists "news_admin_write"                     on public.news;
drop policy if exists "news_admin_update"                    on public.news;
drop policy if exists "news_admin_delete"                    on public.news;
drop policy if exists "website_leads_public_insert"          on public.website_leads;
drop policy if exists "website_leads_admin_read"             on public.website_leads;
drop policy if exists "website_leads_admin_update"           on public.website_leads;
drop policy if exists "website_leads_admin_delete"           on public.website_leads;
drop policy if exists "website_lead_unit_attr_admin_read"    on public.website_lead_unit_attributions;
drop policy if exists "website_lead_unit_attr_public_insert" on public.website_lead_unit_attributions;

-- The grants migration 7 added to match those policies, so a policy added later
-- for some unrelated reason cannot quietly re-open them.
revoke insert, update, delete on public.content, public.properties, public.news from authenticated;
revoke all on public.website_leads, public.website_lead_unit_attributions from anon, authenticated;

-- Storage: uploads go through the API with the service-role key, which these never
-- governed. Public reads of the buckets stay.
drop policy if exists "images_admin_write"     on storage.objects;
drop policy if exists "images_admin_update"    on storage.objects;
drop policy if exists "images_admin_delete"    on storage.objects;
drop policy if exists "models_admin_write"     on storage.objects;
drop policy if exists "models_admin_update"    on storage.objects;
drop policy if exists "models_admin_delete"    on storage.objects;
drop policy if exists "documents_admin_write"  on storage.objects;
drop policy if exists "documents_admin_update" on storage.objects;
drop policy if exists "documents_admin_delete" on storage.objects;

-- The images bucket was the one created with no limits. Match what the API accepts
-- (apps/api/src/modules/uploads/uploads.service.ts: 10 MB, no SVG).
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'images';
