# Architecture review: Prime Developers website, 1 Nov 2026

**Scope:** PrimeDevelopers-web at `main` 681da20, plus prime-tracker-main at `origin/main` 19d0cb0. The local tracker checkout is on `feat/sale-partial-schedule`, which is older than tracker PR #36, so tracker files were read with `git show origin/main:…`.

**Method:** read-only.
- Nothing in either repo was modified.
- One live check was made: two public GETs of `https://dtw8rs0oq8bpp.cloudfront.net/api/properties/centro-plaza`.
- No `.env` files were read.

**In-flight work:** another agent has uncommitted edits in `apps/web`:
- `siteModel.js`, `unitChecks.js`, `SiteModelManager.jsx`, `UnitFields.jsx`, `completeness.js`, `ModelViewer.jsx`;
- it is building the building-first tagging and per-field tracker locks;
- line numbers below are at HEAD (681da20) unless stated.

**Builds on:** `docs/system-audit-2026-10-24.md` and `docs/website-audit-2026-10-27.md`. Items those audits found and that are now fixed are listed once in §b.0 and not repeated.

**Paths:**
- Linked paths are relative to `/Users/kalyan/Client-project/PrimeDevelopers-web`.
- Paths prefixed "tracker" are in `/Users/kalyan/Client-project/prime-tracker-main` at `origin/main`.

---

## (a) Current-state architecture

### Topology

```
Visitor ─► CloudFront E25N0DCCIGFVRS (WAF, CSP report-only)
            ├─ /*          → S3 prime-tracker-website-056836825737 (SPA, OAC)
            ├─ /api/img/*  → cached (website_images policy) ─┐
            └─ /api/*      → CachingDisabled + X-Origin-Verify ┤
                                                             ▼
          ONE EC2 (Terraform default t3.micro, 914 MiB; auto-recover; <eip>.nip.io)
            nginx ─ /website-api/ → PM2 prime-website-api :3002  (unix user prime-website)
                  ─ Prime Tracker API (PM2) + tracker SPA ; Redis (docker, unused)
            tracker @Cron every 5 min ── signed POST ──► CloudFront /api/integrations/tracker/snapshot
                                                          (leaves the box and comes back to it)
                                                             ▼
          RDS Postgres db.m7g.large, Multi-AZ (client.tfvars) — databases prime_tracker + prime_website
          S3 media (website bucket media/), SES (sandbox), CloudWatch logs + alarms, Terraform state on S3

Leftovers: Render "prime-developers-api" (render.yaml, auto-deploys main, Singapore) → Supabase
nrtqntqutquapydsnjbm; supabase/migrations/ (15 SQL files); .firebase/ hosting cache (gitignored);
Firebase Analytics + Performance still loaded by the SPA (intended).
```

### Data model (website)

One Postgres row per property ([schema.prisma:76-101](../../apps/api/prisma/schema.prisma)).
- Columns: `buildings` (which holds the **unit** count), `sold`, `available`, `trackerProjectId`, `trackerSyncedAt`, `updatedAt`.
- Everything about buildings, units and 3D sits in an untyped jsonb `detail`. The DTO deliberately leaves it unvalidated ([property.dto.ts:76-86](../../apps/api/src/modules/properties/dto/property.dto.ts)).

What `detail` holds:
```
detail.floorPlans.buildings[] = {
  building (label), number, units, available,
  trackerBuildingId, tracker{id,name,totalSqft,stories},
  model{url, meshNames, bindings{mesh → unitLabel}},
  unitList[] = { label, status, tenant, size, floor, rate, frontage, description, x, y,
                 logo, images[], tenantUrl, tenantCategory, facingRoad,
                 trackerUnitIds[], tracker{ids,unitNumber,status,sqft,unitType,availableSince,occupant,syncedAt} } }
detail.siteModel = { url, meshNames[364], buildingBindings{mesh → buildingLabel},
                     unitBindings{mesh → {buildingLabel, unitLabel}}, roadBindings, roads[] }
detail.trackerCounts = { units, byStatus{…7 tracker statuses} }
```

Things that reference a unit by **label**:
- the site-model bindings;
- per-building model bindings;
- public unit URLs (`/properties/:slug/units/<building-slug>/<unit-slug>`, [units.js:333-343](../../apps/web/src/lib/units.js));
- lead attribution (`unit_label`, `building_label`, [schema.prisma:182-193](../../apps/api/prisma/schema.prisma));
- the CMS Units store's lookup ([unitsStore.js:64,76](../../apps/web/src/admin/unitsStore.js)).

Ids exist only on the tracker side: `trackerBuildingId`, `trackerUnitIds`.

**Writers of `detail`:**
1. **Property editor.** Sends the whole record, including the property totals, with `expectedUpdatedAt` ([PropertyEditPage.jsx:229-236](../../apps/web/src/admin/PropertyEditPage.jsx), [propertyPayload.js:16-47](../../apps/web/src/admin/propertyPayload.js)). The 3D tagging screens edit this same form.
2. **Units page and Covers.** They re-read the record, apply one change, send `detail` with the token, and retry once on 409 ([unitsStore.js:52-90](../../apps/web/src/admin/unitsStore.js)).
3. **Tracker sync.** It locks the row (`FOR UPDATE`), merges, and writes `floorPlans`, `siteModel` (only when a binding moved), `trackerCounts` and the totals. It also bumps `updatedAt` ([tracker-sync.service.ts:51-111](../../apps/api/src/modules/tracker-sync/tracker-sync.service.ts)).

**Readers:**
- `GET /api/properties` and `/api/properties/:slug` are public, `@Cacheable` (`s-maxage=60`), and return the row as stored ([properties.controller.ts:18-32](../../apps/api/src/modules/properties/properties.controller.ts), [properties.service.ts:16-31](../../apps/api/src/modules/properties/properties.service.ts)).
- All resolution happens in the browser:
  - `reconcileSite` / `toViewerEntries` for 3D ([siteModel.js:83-185, 280-302](../../apps/web/src/lib/siteModel.js));
  - about ten components that read raw unit fields.

**Live state (GET, 1 Nov 2026):**
- Centro is 59 KB of JSON: 9 buildings, 47 rows, totals 54/47/7.
- Sync markers: `trackerProjectId` is null, and **0 rows carry `trackerUnitIds`**, so the sync has never applied in production.
- 3D bindings: 102 building bindings and 58 unit bindings. **30 of the 58 unit bindings are stale**; they now fall back to their building.
- Privacy: 35 sold rows carry a `tenant` string.
- Caching: two consecutive requests were both `x-cache: Miss`.

### Tracker → website sync

Design: [tracker-sync-and-aws-plan.md](../tracker-sync-and-aws-plan.md). Tracker side: `website-sync.service.ts` on tracker `origin/main`.

**Transport and timing:**
- **Push** over HTTPS, signed with an HMAC over `ts.path?query.body` with a 5-minute window.
- **Whole-project snapshot** (v2), every 5 minutes when an in-memory content hash changed, plus an unconditional push every hour.
- The website merge is pure ([tracker-merge.ts](../../apps/api/src/modules/tracker-sync/tracker-merge.ts), 1,117 lines, ~37 tests in `apps/api/test/tracker-sync.test.ts`).

**Matching:**
- Buildings match by `trackerBuildingId`, falling back to name or number the first time.
- Rows match in six passes: by id, by merged-from ids, then by label, unit numbers and overlap.
- Media is carried across splits, combines and moves.
- Unit bindings are re-pointed on relabel.

**Ownership:**
- The tracker owns `label`, `status`, `size` (when it knows it), `tenant` (leased only), `trackerUnitIds` and `row.tracker`.
- The website owns everything else.

**Guards** (409 unless `?force=true`):
- tracker buildings with units that are unmatched;
- removing more than 25% of rows (and more than 3), per building or per property;
- emptying a building;
- removing any row with photos or a pin.

**Audit trail:** each applied change writes `website_tracker_syncs` with the previous `floorPlans` and totals.

**Status:**
- **Off in production.** `WEBSITE_SYNC_URL` and `WEBSITE_SYNC_SECRET` are empty, and `target()` returns null (tracker `apps/api/src/modules/website-sync/website-sync.service.ts:93-98`).
- The rollout plan (dry run first) is in the doc, §"Rollout of Phase 1".

---

## (b) Risks, ranked by impact

### b.0 Already fixed since the two audits — not repeated

**From 27 Oct:**
- C1 property-editor 400: fixed by the field whitelist in `propertyPayload.js`.
- Photo-upload race: fixed with functional updaters (`UnitFields.jsx:21-32`).
- Stale unit binding killing the shape: now falls back to the building ([siteModel.js:101-127](../../apps/web/src/lib/siteModel.js)).
- Site-level labels for unit-tagged buildings: `toViewerEntries` now gives every building entry a `buildingIndex`.
- Partial-push zeroing: fixed.
- Removal guard: now per building, with refusal for rows with photos or pins ([tracker-merge.ts:1047-1076](../../apps/api/src/modules/tracker-sync/tracker-merge.ts)).
- Merge re-points bindings on relabel ([tracker-merge.ts:758-815](../../apps/api/src/modules/tracker-sync/tracker-merge.ts)).
- Per-status counts are stored (`trackerCounts`).
- Explicit building mapping via `trackerBuildingId`.
- Server-side conflict check: `expectedUpdatedAt` under `FOR UPDATE` ([properties.service.ts:51-85](../../apps/api/src/modules/properties/properties.service.ts)).
- Tracker label, status, size and tenant are locked in the unit form; Delete is disabled on synced rows.
- Unknown statuses are no longer published as available.
- The rollout doc's URL is corrected.
- Lead spam filter added.

**From 24 Oct:**
- Origin-verify header.
- `trust proxy` hop setting.
- Resizer width ladder and throttle.
- Website API runs as its own unix user.
- IMDSv2 (`ec2.tf:33-35`).
- RDS is now Multi-AZ.
- Terraform state is on an S3 backend; the local state file is 0 bytes.
- Pre-migration RDS snapshot and Prisma migrations replace `db push`.
- `enableShutdownHooks`.

**Still open from those audits, and folded into the risks below:**
- edge caching;
- `websiteOnly` rows;
- CMS relabels re-keying bindings (helpers merged, not wired);
- totals still typed by hand;
- per-unit save endpoint;
- sync admin page and restore tool;
- error tracking;
- nightly `pg_dump`;
- buyer names and rents (a client decision);
- Render suspension: not re-verified, because no network access was allowed;
- `nip.io` in the origin path.

### b.1 Ranked risks

| # | Impact | Risk | Evidence |
|---|---|---|---|
| 1 | **High** | **Identity is the human label, so renames break links on both writers. The sync has to compensate by writing website-owned data.** | See below |
| 2 | **High** | **Conflicts are detected for the whole property, and the server doesn't enforce field ownership.** Once the sync is on, CMS saves either 409 constantly or overwrite the tracker. | See below |
| 3 | **High** | **A refusal blocks the whole property, retries hourly, and is recorded and alerted nowhere.** Statuses freeze silently. | See below |
| 4 | **High (privacy)** | **The public GET serves the raw blob.** There is no projection layer, and after go-live it will also carry tracker internals. | See below |
| 5 | **High (ops)** | **The compute is a single 1 GiB host with no edge cache in front, next to an over-provisioned database.** | See below |
| 6 | Medium | **The sync is off, and nothing can say whether it is healthy.** The CMS can't show what is tracker-owned or how fresh it is. | See below |
| 7 | Medium | **Push-loop correctness gaps on the tracker side.** | See below |
| 8 | Medium | **The ownership rule exists in two languages, and display code reads raw fields in about ten places.** | See below |
| 9 | Medium | **The optimistic-lock token is a trigger-maintained timestamp, not a version.** | See below |
| 10 | Medium | **Leftover platforms and second writers.** | See below |
| 11 | Low–Med | **Local web dev proxies to production by default.** | See below |

**1. Labels as identity.**
- **Where labels are keys:**
  - bindings: `siteModel.unitBindings`, `siteModel.buildingBindings`, `model.bindings`;
  - URLs: [units.js:333-343](../../apps/web/src/lib/units.js);
  - lead attribution: [schema.prisma:182-193](../../apps/api/prisma/schema.prisma).
- **The CMS re-key helpers exist but aren't called:**
  - `markOriginalLabels` and `rekeyForSave` are marked "Not wired yet" ([units.js:494-501](../../apps/web/src/lib/units.js)), and nothing in `apps/web/src/admin` calls them;
  - `applyUnitChange` re-keys only the per-building model, not the site model ([units.js:461-490](../../apps/web/src/lib/units.js); used by [unitsStore.js:84](../../apps/web/src/admin/unitsStore.js) and [BuildingBlock.jsx:60](../../apps/web/src/admin/components/BuildingBlock.jsx));
  - the building name is freely editable ([BuildingBlock.jsx:73](../../apps/web/src/admin/components/BuildingBlock.jsx)).

  So **renaming a building in the CMS orphans every `buildingBindings` entry for it.** On Centro that is up to 102 shapes, and they turn grey. This hits the planned building-first tagging head-on.
- **The sync writes website-owned data:** it rewrites `siteModel` itself ([tracker-merge.ts:758-784](../../apps/api/src/modules/tracker-sync/tracker-merge.ts); [tracker-sync.service.ts:33](../../apps/api/src/modules/tracker-sync/tracker-sync.service.ts)). That breaks the clean split of ownership.
- **Live data:** 30 of 58 unit bindings are stale.
- **Relabels have no fallback:** a relabelled unit's URL 404s, and its leads point at a label that no longer exists.

**2. Whole-property conflicts, no server-side ownership.**
- **Every sync invalidates open editors:** an applied sync sets `updatedAt` ([tracker-sync.service.ts:100-101](../../apps/api/src/modules/tracker-sync/tracker-sync.service.ts)), so any editor with the property open gets a 409.
- **"Save anyway" overwrites the tracker:** it re-reads only the timestamp and sends the form's stale `detail` plus `buildings`, `sold` and `available` ([PropertyEditPage.jsx:229-236](../../apps/web/src/admin/PropertyEditPage.jsx); totals editable at [PropertyEditPage.jsx:376-395](../../apps/web/src/admin/PropertyEditPage.jsx); building counts at [BuildingBlock.jsx:76-77](../../apps/web/src/admin/components/BuildingBlock.jsx)). That reverts tracker statuses, `trackerUnitIds`, `trackerBuildingId` and re-pointed bindings until the next hourly push (`FULL_PUSH_INTERVAL_MS`).
- **Unconditional writes are still possible:** a PATCH without the token is unconditional ([properties.service.ts:52-58](../../apps/api/src/modules/properties/properties.service.ts)).
- **No shape check on `detail`:** it is not validated, so a malformed save can break the public page.

**3. Refusals block silently.**
- **One problem refuses everything:** a single website-only row with a photo in a linked building, or one unmatched tracker building with units, refuses the entire push ([tracker-merge.ts:1047-1077](../../apps/api/src/modules/tracker-sync/tracker-merge.ts)).
- **Retries are hourly:** the tracker stores the hash on a 409 and so retries only hourly (tracker `website-sync.service.ts:245-250`).
- **No trace on the website:** it throws before the audit row ([tracker-sync.service.ts:70-73](../../apps/api/src/modules/tracker-sync/tracker-sync.service.ts)).
- **No alert:** the only log metric filter is `nginx_5xx` (tracker `monitoring.tf:602`).
- **The CMS creates exactly these rows today:**
  - "Add unit" ([UnitsAdminPage.jsx:72](../../apps/web/src/admin/UnitsAdminPage.jsx));
  - tap-to-create in 3D (`SiteModelManager.jsx@HEAD:150-156, 231`);
  - the in-flight edit blocks the second one for tracker buildings. That edit is not committed, and the merge has no `websiteOnly` flag.

**4. Raw blob served publicly.**
- **The response as stored:** row in, row out ([properties.controller.ts:18-32](../../apps/api/src/modules/properties/properties.controller.ts)).
- **What it exposes live:**
  - 35 sold rows with a tenant string, shown because `TENANTED` includes `sold` ([unitStatus.js:85](../../apps/web/src/lib/unitStatus.js); [UnitDetailCard.jsx:88-96](../../apps/web/src/components/UnitDetailCard.jsx));
  - `trackerProjectId`.
- **What go-live will add:** `row.tracker` (ids, `unitType`, `availableSince`, `occupant`), `building.tracker`, and `detail.trackerCounts`, which shows pipeline counts by status, UNDER_CONTRACT and LEASE_PENDING included ([tracker-sync.service.ts:24-35](../../apps/api/src/modules/tracker-sync/tracker-sync.service.ts)). That is why asking rent and price are dropped today ([tracker-merge.ts:79-87](../../apps/api/src/modules/tracker-sync/tracker-merge.ts)).
- **Buyer names in tracked source:** they are hardcoded in [scripts/sync-centro-from-tracker.mjs:48+](../../scripts/sync-centro-from-tracker.mjs). The 24 Oct audit describes this repo as public.

**5. Compute single point of failure.**
- **One small host:** client.tfvars doesn't set `ec2_instance_type`, so it is t3.micro (tracker `variables.tf:59-62`). It runs both APIs, the tracker SPA, nginx and Redis. The repo's own plan says this doesn't fit ([tracker-sync-and-aws-plan.md:301-302](../tracker-sync-and-aws-plan.md)).
- **An oversized database beside it:** RDS is `db.m7g.large` and Multi-AZ, so the database is redundant while the compute is not.
- **No edge cache:** `/api/*` uses CachingDisabled (tracker `website.tf:335-341`) although the API sends `s-maxage=60` ([cacheable.decorator.ts:25](../../apps/api/src/common/decorators/cacheable.decorator.ts)). Two Misses were confirmed live.
- **Third-party DNS:** the origin goes through `nip.io` (tracker `locals.tf:23`, `website.tf:47`).
- **Restores are shared:** restoring `prime_website` means restoring the whole shared instance ([02-deploy-api.sh:127](../../scripts/aws/02-deploy-api.sh)).
- **The sync hairpins:** a push leaves the box and comes back to it through CloudFront and the WAF.

**6. No sync health signal.**
- **Never applied:** `trackerProjectId` is null and no rows carry `trackerUnitIds` (live).
- **Not even the timestamps are shown:** `trackerSyncedAt` changes only when a push changes something, and nothing in `apps/web/src` reads it, `row.tracker` or `trackerCounts` (grep, HEAD).
- **No "last contact":** "healthy, nothing changed" and "dead for three days" look the same.
- **Ownership is a guess:** the CMS lock is a heuristic on whether `trackerUnitIds` is present ([UnitFields.jsx@HEAD:30-55](../../apps/web/src/admin/components/UnitFields.jsx)). Per-field locks are in flight in uncommitted `unitChecks.js` (`trackerOwnedFields`).

**7. Push-loop gaps (tracker side).**
- **Full-push starvation:** a project that keeps failing with a non-409 (say, a 404 from a slug typo) stops `lastFullPushAt` from advancing (`website-sync.service.ts:260`). Then every 5-minute tick pushes every project.
- **Out-of-order snapshots are applied:** the website has no `generatedAt` monotonic check, and a manual push (`website-sync.controller.ts:29-38`) can race the cron. "Order never matters" ([tracker-sync-and-aws-plan.md:44-45](../tracker-sync-and-aws-plan.md)) holds only for identical snapshots.
- **State is per process:** the hash lives in memory (`:78`), so this assumes a single instance. The tracker can't scale out anyway (24 Oct audit).
- **Stale tuning:** the 60-second timeout was chosen for Render cold starts (`:7-8`).

**8. Ownership rule duplicated.**
- **Two copies of the rule:**
  - the merge's rule: `mergeRow` ([tracker-merge.ts:673-705](../../apps/api/src/modules/tracker-sync/tracker-merge.ts));
  - the UI's copy: `UnitFields`, plus the in-flight `trackerOwnedFields` that "mirrors mergeRow()".
- **Public components read raw fields:**
  - [UnitDetailCard.jsx:49-68](../../apps/web/src/components/UnitDetailCard.jsx)
  - [UnitPage.jsx:50-57](../../apps/web/src/pages/UnitPage.jsx)
  - [AvailableUnits.jsx:350, 472, 501](../../apps/web/src/components/AvailableUnits.jsx)
  - [UnitComparePanel.jsx:9-17](../../apps/web/src/components/UnitComparePanel.jsx)
  - [investment.js:95-97](../../apps/web/src/lib/investment.js)
  - `ModelViewer.jsx@HEAD:1922`
- **Consequence:** there is no single place to introduce a "tracker first, CMS fallback" rule.
- **Provenance is lost:** once the sync writes `size`, the CMS value is gone. If the tracker later drops `sqft`, the old tracker value stays and looks like CMS data.

**9. Timestamp as the version token.**
- **The trigger overrides the service:** `set_updated_at` sets `updated_at = now()` ([1_updated_at_triggers/migration.sql:4-17](../../apps/api/prisma/migrations/1_updated_at_triggers/migration.sql)), replacing the monotonic value the service writes. So the comment at [properties.service.ts:80-82](../../apps/api/src/modules/properties/properties.service.ts) is untrue.
- **It can go backwards:** `now()` is the transaction's start time. If a sync transaction started before an editor's commit and writes after it, `updatedAt` moves backwards.
- **Precision mismatch:** tokens compare at millisecond precision while the column stores microseconds.
- **Severity:** a lost update is unlikely, but the scheme is fragile.

**10. Leftover platforms and second writers.**
- **Render:** [render.yaml](../../render.yaml) still says the front end is on Firebase, and Render auto-deploys `main` against Supabase.
- **Two schema histories:** [schema.prisma:1-16](../../apps/api/prisma/schema.prisma) still names `supabase/migrations` as the DDL source of truth and describes a "shared Supabase project", while `apps/api/prisma/migrations` (0–2) is what AWS runs.
- **A second writer:** `scripts/sync-centro-from-tracker.mjs` writes through Supabase and bypasses every guard.
- **Firebase cache:** `.firebase/` (gitignored) is harmless.

**11. Dev proxies to production.**
- **The default target is live:** `DEV_API_TARGET` defaults to the deployed API ([vite.config.js:58-99](../../apps/web/vite.config.js); [tasks/plan.md](../../tasks/plan.md), "Architecture Decisions").
- **Consequence:** a local admin session writes to production.
- **The API side is the same:** per project memory, `apps/api/.env` also points at production.

---

## (c) ADR

# ADR-001: Unit details resolve from two owned layers through one shared resolver: tracker first, CMS fallback, with 3D bound by id

**Status:** Proposed
**Date:** 2026-11-01
**Deciders:** Kalyan (tech lead), the client (the privacy items flagged below), whoever owns the Prime Tracker side

## Context

**The planned change:**
- The site model will be tagged building-first: mesh → building, then units within each building.
- Unit details come from Prime Tracker and fall back to what CMS editors entered when the tracker has none.

**Constraints already in place:**
- **The tracker owns inventory facts** (label, status, size, the lease tenant). The website owns marketing (photos, description, pins, 3D, logo, rate).
- **The tracker pushes;** the website never reads it ([tracker-sync-and-aws-plan.md, Decisions 1–4](../tracker-sync-and-aws-plan.md)).
- **Rows already carry a sync-only `tracker` sub-object.** Nothing reads it ([tracker-merge.ts:107-131](../../apps/api/src/modules/tracker-sync/tracker-merge.ts)).

**Forces:**
1. **"The tracker has none" means three different things:**
   - the building isn't in the tracker at all (Centro's Buildings 3 and 10; Leander, Rio Ranch and Cap Rate today);
   - the unit isn't in the tracker (a website-only row in a linked building);
   - the unit is linked but a field is null (`sqft`, `unitType`).
2. **Today the sync overwrites the same top-level fields the CMS edits.** So the source of a value can't be known after the fact, and a CMS fallback is destroyed once the tracker supplies a value (risks 2 and 8).
3. **About ten public components read raw fields,** so a precedence rule has nowhere single to live (risk 8).
4. **`detail` is public as stored** (risk 4).
5. **3D bindings are keyed by label,** so the sync must rewrite website-owned `siteModel` and CMS renames orphan shapes (risk 1). Building-first tagging is the moment to change the key cheaply, before more tagging work is stored by label.
6. **Team and stack:** a small team, a jsonb blob, a pure merge with good tests, and an existing pattern of plain-JS modules shared between web and API tests (`propertyPayload.js`, `unitChecks.js`).

## Decision

**1. Two layers per unit row, each with one writer.**
- `row.tracker`: written only by the sync. It is already written; add `websiteStatus` (the mapped status) so readers don't need the status map.
- Top-level website fields: written only by the CMS.
- **Once readers use the resolver, the sync stops writing top-level `status`, `size` and `tenant`.** It keeps writing `trackerUnitIds` and the row id.
- The sync keeps writing `label` until 3D and URLs are keyed by id (part 4).

**2. One pure, shared resolver,** `resolveUnit(row, building)` → `{ values, source }`. It lives in a small workspace package (`packages/unit-policy`, plain ESM and d.ts) that the API (at runtime) and the web app both import. It holds a single `FIELD_POLICY`:

| Field | Linked row (`trackerUnitIds` non-empty) | Unlinked row (website-only building or unit) |
|---|---|---|
| `label` | tracker (normalised `unitNumber`), locked | CMS |
| `status` | tracker `websiteStatus`, locked. An unknown status keeps the last known one. **No CMS fallback:** a stale CMS status must never beat the tracker | CMS |
| `size`, `unitType` | tracker if non-null, **else CMS** (`source: 'cms-fallback'`, editable) | CMS |
| `availableSince` | tracker only | — |
| `tenant` (leased) | tracker `occupant` if non-null, else CMS | CMS |
| Public party on a **sold** unit | CMS `publicName` only. **Never** the tracker, never the internal `tenant` *(client decision)* | CMS |
| `rate` | CMS. Tracker asking figures only behind an explicit, client-approved flag, and then the CMS still overrides | CMS |
| `description`, `images`, `floor`, `frontage`, `logo`, `tenantUrl`, `tenantCategory` | CMS | CMS |
| Building `units` / `available`; property totals | computed from the resolved rows (never typed) | typed |

**3. Where the source indicator lives.** It is computed by the resolver, never stored.
- **CMS unit editor, per field:** a badge — "From Prime Tracker · synced ⟨row.tracker.syncedAt⟩" (locked, linked to the tracker unit), "Entered here — used until Prime Tracker has a value" (`cms-fallback`, editable), "Entered here" (`cms`), or "Missing".
- **Building:** "Linked to tracker building ⟨name⟩" from `building.tracker`, or "Website-only — units are managed here". The second is what decides whether tap-to-create units is allowed in building-first tagging.
- **Property:** a sync-health strip showing the last push, its outcome (applied, unchanged, refused with reasons, dry run) and its time. It reads a new `website_tracker_sync_status` row written on **every** push, refusals included. It is not stored on `properties`, so heartbeats don't invalidate editors' tokens.
- **Public site:** no source badges. At most "Availability updated ⟨date⟩".

**4. The server enforces it.**
- **Public projection:** `GET /api/properties[/:slug]` returns `toPublicProperty()`, which holds the resolved values. Raw `tracker` layers, `trackerProjectId`, `trackerCounts`, unapproved asking figures and sold-unit internal names are dropped.
- **PATCH:**
  - Tracker-owned layers and totals are taken from the stored row whenever the property is linked. So "Save anyway" can no longer revert the sync.
  - A PATCH carrying `detail` must send a version.
  - The version is a new integer `cms_version`, which the sync doesn't bump. The sync then no longer causes spurious 409s.

**5. Bind 3D to ids, not labels, starting with building-first tagging.**
- **Buildings:** `buildingBindings[mesh] = buildingId`, where `buildingId` is `trackerBuildingId` when linked, otherwise a website-minted id stamped on every building once.
- **Units:** `unitBindings[mesh] = { buildingId, unitKey }`, where `unitKey` is a website-minted row id. The merge carries it through relabels, moves and splits, just as it carries media today.
- **Then:** the sync stops touching `siteModel`, and `rekeySiteBindings` on both sides becomes legacy. Label bindings stay readable as a fallback until a one-off upgrade (dry run first) rewrites them.
- **URLs and leads:** URLs keep label slugs but resolve old slugs through an alias kept on the row. Lead attribution stores `unitKey` alongside the labels.

## Options considered

### Option A: status quo plus a client-side ownership mirror (what is in flight)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | ~1 day |
| Scalability | Poor. Every new tracker field means a change in the merge, the UI mirror and every public reader |
| Team familiarity | High |

**Pros:**
- Ships with building-first tagging.
- No data migration.
- `trackerOwnedFields` already exists in uncommitted `unitChecks.js`.

**Cons:**
- The rule lives in two languages.
- Values are overwritten in place, so provenance is lost and a fallback can't be restored.
- The server doesn't enforce anything; "Save anyway" still clobbers.
- The public JSON stays raw.
- Label-keyed 3D keeps the sync writing `siteModel`.

### Option B: two layers in the jsonb row, a shared resolver, server projection and enforcement, id-keyed bindings (**recommended**)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | ~5–7 engineer-days: package and resolver 1; switch the public readers 1.5; projection and PATCH enforcement 1.5; sync-status table and badges 1; id bindings and upgrade script 1–2 |
| Scalability | Good for this scale (tens of units per property). New fields are one `FIELD_POLICY` entry |
| Team familiarity | High. Same stack, and the same pure-function and shared-module patterns as `tracker-merge.ts` and `propertyPayload.js` |

**Pros:**
- One rule, one place, testable with no database. API tests can assert that merge and resolver agree.
- Fallback and provenance are preserved.
- Privacy is enforced on the server.
- Ends spurious 409s and clobbering.
- Keeps the push model and ownership table exactly as documented.
- Id bindings remove a whole class of rename bugs and keep the sync out of website-owned data.

**Cons:**
- A transition period in which the sync dual-writes (top level and `tracker`) until every reader uses the resolver.
- A one-off migration of the bindings and ids.
- Still a whole-blob row, so concurrency is per property (mitigated by `cms_version` plus the server-side merge).

### Option C: relational `website_buildings` / `website_units` tables (tracker_* and cms_* columns) with per-unit endpoints
| Dimension | Assessment |
|---|---|
| Complexity | High |
| Cost | ~3 weeks: schema, data migration, rewrite of every admin and public reader, merge rewritten against rows |
| Scalability | Best. Per-unit locking, FK lead attribution, SQL views for the projection |
| Team familiarity | Medium. Matches the tracker's own model and the 28 Jul "relational tables" intent |

**Pros:**
- Cleanest end state.
- Aligns with the eventual merge into prime-tracker.

**Cons:**
- A large change while the sync isn't even live and wave 2 is unstarted.
- It doesn't by itself decide precedence; it still needs the same field policy.

### Option D: read the tracker live when a page loads
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Low to build, high to run |
| Scalability | Poor. The public site would depend on the internal app, on one t3.micro |
| Team familiarity | High |

**Rejected:**
- It reverses documented decision 2: no public traffic reaches the tracker, and a tracker outage must not blank the site.
- It widens the privacy boundary.

## Trade-off analysis

**B against A.** A is cheaper this week, but it entrenches the two defects that matter most once the sync is on:
- **Overwritten provenance:** fallback values are lost, and nobody can tell where a value came from.
- **No server enforcement:** clobbering and leaks.

B's extra ~5 days pay for themselves the first time an editor's "Save anyway" would have reverted a sync, or the first rename in building-first tagging.

**B against C.** B captures about 80% of C's benefit for about 30% of the cost.
- **What B leaves out:** per-unit locking, real FKs.
- **What B adds:** the resolver and `FIELD_POLICY` port unchanged to C later, because C needs the same policy.

So B is a step toward C, not a detour.

**Strict tracker precedence for `status`, with no fallback, is deliberate.** Advertising a unit as available because the CMS said so is the costliest error this site can make.

## Consequences

**Easier:**
- New tracker fields: add a policy row.
- Showing editors exactly what is tracker-owned and how fresh it is.
- Privacy reviews: one projection function.
- Renaming buildings and units on either side without touching 3D.
- Turning the sync on without fighting the editors.

**Harder:**
- A shared workspace package adds a build step for the API.
- A transition period in which the top-level fields and the `tracker` layer both exist. The resolver must prefer `tracker` and tolerate rows with no layer: un-synced rows resolve as `cms`.

**To revisit:**
- Whether website-only units count in the headline totals: today they would disagree with the tracker header. A client call.
- How UNDER_CONTRACT and LEASE_PENDING map.
- Whether asking figures are published.
- Sold-unit public names.
- Moving to Option C when the merge with prime-tracker starts.

## Action items
1. [ ] Create `packages/unit-policy` with `FIELD_POLICY`, `resolveUnit` and `resolveBuilding`, plus table-driven tests. Add an API test that runs `mergeRow` and then `resolveUnit` and asserts that every locked field equals the tracker's value. Move the in-flight `trackerOwnedFields` here.
2. [ ] The sync writes `tracker.websiteStatus`, and every new or continued row gets a minted `id` (carried by `primaryOf`). Keep the top-level dual-write until step 4 ships.
3. [ ] Add `cms_version` (int) to `properties`. PATCH requires it whenever `detail` is present. The server merges tracker-owned layers, `trackerBuildingId`, `building.tracker` and the totals from the stored row on linked properties.
4. [ ] Switch every public reader (list in risk 8) to `resolveUnit`. Ship `toPublicProperty()` on the public GETs, and add a test that the raw `tracker`, `trackerCounts` and `trackerProjectId` are absent.
5. [ ] Add a `website_tracker_sync_status` table written on every push (applied, unchanged, refused, dry run). Show the property strip, the building badge and per-field badges in the CMS.
6. [ ] Building-first tagging writes `buildingId` and `unitKey`. Allow tap-to-create units only on website-only buildings, and mark those rows `origin: 'cms'` so the merge keeps them and reports them. Write a one-off script, dry run first, that upgrades Centro's label bindings (re-tag Building 6 afterwards).
7. [ ] Follow-up: slug aliases for unit URLs, and `unit_key` on `website_lead_unit_attributions`.

---

## (d) Prioritized recommendations

**P0: before the sync goes live**
1. **Make CMS writes unable to undo the sync** (ADR action 3): a server-side merge of tracker-owned fields and totals, a mandatory version on `detail` writes, and an integer `cms_version` the sync doesn't bump. **S–M**
2. **Make refusals visible and non-silent:**
   - persist every push outcome;
   - add a CloudWatch metric filter and alarm on `Website refused` and on non-empty report issues;
   - reject snapshots older than the last applied `generatedAt`;
   - stop one failing project from starving `lastFullPushAt`. **S**
3. **Stop creating rows the sync will delete or block on:**
   - land the in-flight guard on tap-to-create and "Add unit" for tracker-linked buildings;
   - add a `websiteOnly` (`origin: 'cms'`) rule to the merge. **S–M**
4. **Stop renames orphaning 3D,** in either of two ways:
   - wire `markOriginalLabels` and `rekeyForSave` into PropertyEditPage, BuildingBlock and unitsStore now;
   - or lock the building name on site-model properties until id bindings land (ADR part 5). **S**
5. **Public projection:**
   - strip `trackerProjectId`, raw `tracker` layers and `trackerCounts`;
   - get the client's decision on sold-unit names and remove them from `scripts/sync-centro-from-tracker.mjs`;
   - delete that script. **S**

Then follow the doc's dry-run rollout for Centro.

**P1: next sprint**

6. **Implement ADR-001:** the resolver package, public readers, badges and id-keyed bindings, alongside building-first tagging. **M**
7. **Edge-cache the public GETs:** a CloudFront cache policy that honours `s-maxage`. This is the cheapest relief for the shared host. **S**
8. **Right-size the topology:**
   - move EC2 to at least t3.small or t3.medium, or give the website API its own small instance or task;
   - re-check whether `db.m7g.large` Multi-AZ is the right spend next to a 1 GiB host;
   - put the origin on a real domain instead of `nip.io`. **M** (cost decision)
9. **Admin sync page:** last reports, a dry-run preview, and a restore from `website_tracker_syncs.previous_floor_plans`. **M**

**P2: housekeeping**

10. **Retire the leftovers:**
    - suspend Render and delete `render.yaml`;
    - move `supabase/` to `docs/history/` and rewrite the `schema.prisma` header so `prisma/migrations` is the single schema history;
    - delete `.firebase/`. **S**
11. **Point local development at a non-production API by default.** Make writing to production an explicit opt-in. **S**
12. **Replace the trigger-maintained `updated_at` token with the integer version everywhere,** and fix the misleading comment at `properties.service.ts:80-82`. **S**
13. **Longer term: Option C** (relational units), when the merge with prime-tracker starts.

**Could not verify (no network or AWS access):**
- whether the Render API is still live;
- the actual EC2 instance type in AWS (Terraform default only);
- whether the GitHub repo is still public.
