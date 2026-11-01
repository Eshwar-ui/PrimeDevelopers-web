-- The site model's 3D bindings as they were before each tracker sync. A push
-- that relabels, moves, combines or splits rows re-points shapes in
-- `detail.siteModel`, so restoring `previous_floor_plans` alone left those
-- shapes on labels the restored rows no longer have. Additive; rows written
-- before this stay null.
alter table public.website_tracker_syncs
  add column if not exists previous_site_bindings jsonb;
