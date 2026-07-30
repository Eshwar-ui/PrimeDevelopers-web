-- Fixes the live "permission denied for table content" outage.
--
-- Root cause: every RLS policy for these tables already exists (from
-- migration 6), but the underlying Postgres role grants do not — Postgres
-- checks table-level GRANTs *before* it ever evaluates a row-level security
-- policy, so with no grant, `anon`/`authenticated` are rejected outright and
-- RLS never gets a chance to run. A normal Supabase project sets these grants
-- automatically when a table is created through the dashboard; this schema
-- was evidently created by hand (directly via SQL), which skips that step.
--
-- Each grant below matches exactly what that table's own existing RLS policy
-- already intends — nothing broader, and nothing outside the website's own
-- tables. No `GRANT ... ON ALL TABLES IN SCHEMA public` — this project is
-- shared with another application, and a schema-wide grant would silently
-- change that application's access model too.

-- content: public read, admin write (content_public_read / content_admin_write)
grant select on public.content to anon;
grant select, insert, update, delete on public.content to authenticated;

-- properties: public read, admin write (properties_public_read / properties_admin_*)
grant select on public.properties to anon;
grant select, insert, update, delete on public.properties to authenticated;

-- news: public read, admin write (news_public_read / news_admin_*)
grant select on public.news to anon;
grant select, insert, update, delete on public.news to authenticated;

-- website_leads: public insert only, admin read/manage
-- (website_leads_public_insert / website_leads_admin_*) — anon deliberately
-- does NOT get select here, matching the existing RLS design: a visitor can
-- submit a lead but never read other people's leads back.
grant insert on public.website_leads to anon;
grant select, update, delete on public.website_leads to authenticated;

-- website_lead_unit_attributions: same public-insert / admin-read shape
-- (website_lead_unit_attr_public_insert / website_lead_unit_attr_admin_read)
grant insert on public.website_lead_unit_attributions to anon;
grant select on public.website_lead_unit_attributions to authenticated;
