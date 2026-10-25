-- ── Prime Tracker → website unit sync ─────────────────────────────────────
-- Prime Tracker is the client's source of truth for who has bought or leased
-- which unit. It pushes a snapshot of each linked project to
-- POST /api/integrations/tracker/snapshot, and the API merges the tracker's
-- fields into `properties.detail.floorPlans.buildings[].unitList`. See
-- docs/tracker-sync-and-aws-plan.md.
--
-- `tracker_project_id` is the tracker's cuid for the project. It is stamped on
-- the first sync, which finds the property by slug; every sync after that finds
-- it by id, so renaming the slug on either side cannot break the link. Unique,
-- because two properties mirroring one project would each recompute totals for
-- the same units.
alter table public.properties
  add column if not exists tracker_project_id text,
  add column if not exists tracker_synced_at  timestamptz;

create unique index if not exists properties_tracker_project_id_key
  on public.properties (tracker_project_id);

-- One row per sync that changed something. `previous_floor_plans` and
-- `previous_totals` are what the property held immediately before, so any sync
-- can be undone by writing them back — this replaces the hand-made
-- `*-units-backup-*.json` files at the repo root. A sync that changed nothing
-- writes no row: the tracker pushes every project hourly whether or not it
-- changed, and logging those would bury the real ones.
create table if not exists public.website_tracker_syncs (
  id                   uuid primary key default gen_random_uuid(),
  property_id          uuid not null references public.properties(id) on delete cascade,
  tracker_project_id   text not null,
  report               jsonb not null,
  previous_floor_plans jsonb,
  previous_totals      jsonb not null,
  forced               boolean not null default false,
  created_at           timestamptz not null default now()
);

alter table public.website_tracker_syncs enable row level security;

create index if not exists website_tracker_syncs_property_idx
  on public.website_tracker_syncs (property_id, created_at desc);

-- Same posture as migration 10: only the API's own role reaches this table.
-- The default-privileges change there already covers new tables, but saying
-- it here keeps this file correct even if applied to a database without it.
revoke all on public.website_tracker_syncs from anon, authenticated;
