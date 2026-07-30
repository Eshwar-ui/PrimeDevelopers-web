-- Two corrections to the record, one of them structural.
--
-- ── 1. This database is NOT shared ───────────────────────────────────────
-- Migration 6 states it was "applied to shared Supabase project that already
-- has a construction-mgmt schema", and migration 7 avoids a schema-wide GRANT
-- because it "is shared with another application". Neither is true. Verified
-- against the live database (project knghxhtfkbswzhphhigy) on 30 Jul 2026, the
-- `public` schema contains exactly five tables, all of them this website's:
--
--   content, properties, news, website_leads, website_lead_unit_attributions
--
-- Every other schema present (auth, storage, realtime, vault, graphql,
-- extensions) is a Supabase built-in. The construction-management application
-- lives in a different Supabase project entirely.
--
-- This matters because the shared-database premise made several decisions look
-- riskier than they are: tightening RLS and grants on these tables cannot
-- affect another application, because there isn't one here. The `website_`
-- prefix is now just a name — harmless, and not worth a rename given the data
-- already in those tables.
--
-- ── 2. website_lead_unit_attributions.property_id was nullable ───────────
-- Migration 6 wrote `property_id uuid references public.properties(id)` with no
-- NOT NULL, so the column is nullable. `lead_id` escaped the same fate only
-- because it is part of the primary key, which forces NOT NULL implicitly.
--
-- A unit attribution with no property identifies nothing — it names a unit
-- label floating free of the development it belongs to. The API already refuses
-- to write one (propertyId and unitLabel are all-or-nothing in
-- CreateLeadDto/LeadsService), so this adds the matching guarantee at the
-- storage layer, where it cannot be bypassed.
--
-- Safe to run: the table is empty as of this migration. The guard below fails
-- loudly rather than silently if that ever stops being true.

do $$
begin
  if exists (
    select 1 from public.website_lead_unit_attributions where property_id is null
  ) then
    raise exception
      'Cannot set property_id NOT NULL: % row(s) have a null property_id. Resolve them first.',
      (select count(*) from public.website_lead_unit_attributions where property_id is null);
  end if;
end $$;

alter table public.website_lead_unit_attributions
  alter column property_id set not null;
