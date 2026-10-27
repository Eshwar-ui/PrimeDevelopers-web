# Prime Tracker → website unit sync, and the move to AWS

Status: **Phase 1 merged and deployed, sync switched off.** Written 23 Oct 2026;
hardened 27 Oct 2026 after the website audit (branches `fix/sync-safety` in both
repositories — see "Safety" and the rollout below).

- Website: `PrimeDevelopers-web`, `apps/api/src/modules/tracker-sync`
- Tracker: `prime-tracker-main`, `apps/api/src/modules/website-sync`

## Decisions

1. **Prime Tracker is the source of truth for unit inventory.** The website keeps
   everything that is marketing: photographs, descriptions, floor-plan pins, 3D
   bindings, logos, rates.
2. **The tracker pushes; the website never reads the tracker.** Public traffic
   never reaches the internal app, and a tracker outage leaves the website showing
   its last good inventory rather than nothing.
3. **Only public-safe fields leave the tracker.** No buyer names, sale prices,
   deposits, lease rents or tenant contact details are in the payload at all — the
   filter is in the tracker, so a website bug cannot leak what it never received.
4. **Records are linked by tracker id, not by unit name.** Label matching is used
   once, for the first sync of an existing property, and every row is stamped with
   its tracker unit ids from then on.
5. **One RDS server, two databases** after the AWS move: `prime_tracker` and
   `prime_website`, with separate database users. Images and videos live in S3,
   not the database.

## How the sync works

```
Prime Tracker API (EC2)                         Website API
  every 5 min: for each project with             POST /api/integrations/tracker/snapshot
  websiteSlug set, build a snapshot  ───────►      verify HMAC + timestamp
  push if it changed, and every hour               find property (tracker id, else slug)
  regardless                                        merge tracker fields into unitList
                                                    recompute totals, write audit row
```

- **Polling with a content hash, not events.** BullMQ is a dependency of the
  tracker but no queue is wired, and status changes come from a dozen services.
  Polling every 5 minutes catches every kind of edit with no change to existing
  services. The hourly unconditional push repairs anything an editor overwrote in
  the CMS.
- **Snapshot, not deltas.** Each push is the whole project. Applying it twice is
  harmless, order never matters, and a failed push is simply retried next tick.
- **The website writes only when something changed**, so the hourly push costs a
  read and a comparison.

### Signing

`X-Prime-Timestamp: <unix ms>` and
`X-Prime-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<path and query>.<raw body>")>`.
The path and query are signed so a captured push cannot be replayed with `?force=true` added.
The website rejects a timestamp more than 5 minutes from its own clock. Both sides
read the secret from `TRACKER_SYNC_SECRET` (website) / `WEBSITE_SYNC_SECRET`
(tracker) — the same value, generated with `openssl rand -hex 32`.

### Payload

The website accepts version 1 and version 2; version 2 only adds fields.

**Deploy order: the website first, then the tracker.** The website rejects any
field it does not know, so a tracker sending version 2 to a website that only
knows version 1 gets HTTP 400 on every push. Don't mix versions either: a
version 1 push after a version 2 one blanks the version 2 values under
`row.tracker` and `building.tracker`, and the next version 2 push puts them back,
so alternating rewrites the property on every push.

Version 1:

```json
{
  "version": 1,
  "generatedAt": "2026-10-23T10:00:00.000Z",
  "project": { "id": "cmtiyjnbg01bdh360e0mfslii", "name": "Centro Plaza", "websiteSlug": "centro-plaza" },
  "buildings": [
    {
      "id": "…", "name": "Building 2",
      "units": [
        { "id": "…", "unitNumber": "203", "status": "LEASED", "sqft": 1510, "dealRef": "LEASE:JB-SREE", "occupant": "JB Sree Ventures" },
        { "id": "…", "unitNumber": "205", "status": "SOLD",   "sqft": 1441, "dealRef": null, "occupant": null }
      ]
    }
  ]
}
```

- `status` is the tracker's own enum; the website maps it (below).
- `dealRef` is set when units are let or sold together as one deal
  (`combinedDealRef` on the lease, or on the sale for a sold unit) — the same rule
  as the tracker's "N units leased together". Units sharing a `dealRef` in one
  building become one website row labelled `203+204`.
- `occupant` is the tenant brand (falling back to the tenant name) of the unit's
  active lease. It is **never** a buyer.
- Archived units, units merged into another, and archived buildings are left out.

Version 2 adds, all optional to the website:

| Field | What it is |
|---|---|
| `unit.dealUnitIds` | Every unit in the building in a deal with this one, itself included, whatever their statuses (any live sale's `combinedDealRef`, or the active lease's). `dealRef` still decides the grouping. Accepted, but the website does not match on it: deal partners are different units, and matching on them swapped photographs between partners renumbered together. |
| `unit.mergedFromIds` | The units combined into this one, two combines deep. Combining mints a new unit id, so this is how the website knows what it continues. |
| `unit.unitType` | The tracker's unit type key, e.g. `RETAIL`. |
| `unit.askingRent`, `unit.askingPrice` | List figures, sent **only while the unit is AVAILABLE or UNDER_CONSTRUCTION**, so neither can be read as what a tenant or buyer agreed. **Accepted and dropped by the website for now:** `detail` is public as stored, so they are held until the client approves publishing them. Phase 2 adds public-read filtering of `tracker` data. |
| `unit.availableSince` | ISO date, when the unit last became available. |
| `building.totalSqft`, `building.stories` | From the tracker's building. |

Never sent, in either version: buyers, sale prices, lease rents, deposits, contact
details.

### Who owns which field

| Field on a website unit row | Owner |
|---|---|
| `label`, `status`, `trackerUnitIds` | Tracker |
| `size` | Tracker when it has a sqft; otherwise the website's value stays |
| `tenant` | Tracker for leased units; cleared when a unit becomes available. When every unit of the row is LEASE_PENDING (the sitting tenant is leaving), cleared only if it is the name the sync last sent (`tracker.occupant`) — a tenant typed in the CMS stays. **Left alone on sold units** |
| `tracker` (sub-object) | Tracker only: `ids`, `unitNumber`, `status` (the tracker's own), `sqft`, `unitType`, `availableSince`, `occupant` (what the sync sent as the tenant), `syncedAt`. Nothing reads it yet; the top-level fields above are still written exactly as before, so the public site and the CMS are unaffected. `syncedAt` is when these values last changed, not the last push. |
| `images`, `description`, `x`/`y`, `logo`, `rate`, `floor`, `frontage`, `tenantUrl`, `tenantCategory`, `facingRoad` | Website |

On each matched building the sync writes `trackerBuildingId` (the mapping, see
below), `units`, `available` and a `tracker` sub-object (`id`, `name`, `totalSqft`,
`stories`). On the property it writes `detail.trackerCounts`: the units in the
snapshot per tracker status. Relabels and moves also re-point
`detail.siteModel.unitBindings` and the building's own `model.bindings`.

**Note:** `detail` is returned whole by the public `GET /api/properties/:slug`, so
`row.tracker` and `trackerCounts` are readable in the public JSON, though nothing
renders them. That is why asking figures are not stored yet.

### Headline totals

`buildings` (the unit count), `sold` and `available` keep their formula: units in
matched buildings, plus the stored figures of website buildings the tracker lacks,
plus the units of tracker buildings with no website building; `sold` is every unit
that is not available. So UNDER_CONTRACT, LEASE_PENDING and UNDER_CONSTRUCTION
count as taken, while the tracker's header counts SOLD + LEASED + OCCUPIED. The
client decides how the two pending states count; `detail.trackerCounts` lets the
headline follow that decision without another push.

### Status mapping (tracker → website)

| Tracker | Website |
|---|---|
| AVAILABLE | available |
| UNDER_CONSTRUCTION | coming-soon |
| LEASED, OCCUPIED | leased |
| SOLD | sold |
| LEASE_PENDING | leased **(client to confirm)** |
| UNDER_CONTRACT | sold **(client to confirm)** |

Both "pending" states are shown as taken so the site never advertises a unit
that is spoken for. Changing either is one line in
`apps/api/src/modules/tracker-sync/tracker-merge.ts`.

A status the website does not know (one a newer tracker added) is **never** read
as available. The row keeps its previous status and is listed in the report under
`unknownStatus`; a new unit with an unknown status is not created until its status
is one the website knows, but it is counted in the totals as not available.

### Matching

- **Buildings.** A website building's `trackerBuildingId` is the mapping. Once a
  building has matched, it matches by that id and nothing else, whatever either
  side is renamed. Name, then trailing number, is only the first-time fallback for
  a building never linked. A linked building whose tracker building has gone (or
  that was duplicated in the CMS, link and all) is listed under `staleLinks` and
  left as it is. One whose tracker building has gone is still counted; a duplicate
  is not, since its tracker building's units are already counted once.
- **Rows.** By tracker id first, across buildings, so a unit moved to another
  building keeps its photographs and description. Its 2D pin is cleared — it was a
  point on the old building's plan — and the move entry says so (`pinCleared`).
  Then by the ids a combined unit was made from.
  Then, only for rows not linked to a unit the snapshot still has, by label, by the
  same unit numbers, and by any unit number in common. Labels are normalised:
  trimmed, a leading "Unit", "Suite" or "#" stripped, leading zeros dropped, and
  no spaces around "+" — "Unit 905", "0906" and "203 + 204" are 905, 906 and
  203+204.
- **Splits and combines.** A new or renamed row takes photographs, description and
  pin from every earlier row that held its own units or the units it was combined
  from (or, before rows carry ids, shares a unit number), into what it lacks.
  So `402+404` splitting into 402 and 404 leaves the photographs on both, and 701
  and 702 combining keeps both sets. A row that carries on unchanged never gives
  or takes media — Building 2's 201 stays apart from `201+202+203+204` — and deal
  partners never trade media. A row absorbed into one other row has its 3D shapes
  re-pointed at it; its other website fields the combined row lacks (a logo, a
  link, a second pin) are not merged, and its `absorbed` entry lists them under
  `dropped`.
- **3D bindings.** A relabel or a move re-points `siteModel.unitBindings` and the
  building's `model.bindings` (including a `unit-605` shape linked by name), keyed
  as `apps/web/src/lib/siteModel.js` and `units.js` key them. A removed row's
  bindings are left alone: render ignores a stale binding, and restoring the unit
  re-links its shape.

### Safety

Each of these refuses the push with HTTP 409 and the full report, unless it is
sent with `?force=true`. The report's `refusals` lists every reason, forced or
not.

- **Partial pushes.** Tracker buildings with units but no website building — or a
  property with no floor-plan buildings on the website at all, like Leander — are
  refused, listing the buildings. Before this, Leander's 81/48/33 became 0/0/0.
  Forced, the matched part is applied and the unmatched units are counted in the
  totals, so nothing shrinks. A tracker building with no units is only reported.
  Force means "these buildings are not on the website": if one is there under
  another name, fix the name instead, or its units count twice.
- **Removal guard, per building and per property.** More than a quarter of the
  rows (and more than three) in any one building, or in the whole property;
  emptying a building that had rows; and removing **any** row that has photographs
  or a placement pin (x/y). A broken tracker query must not empty the site, and
  there is no restore tool yet.
- Rows whose units moved, split or combined into other rows are not removals:
  they are listed as `movedOut` or `absorbed`, with their media carried.
- **Every applied sync stores the previous `floorPlans` and totals** in
  `website_tracker_syncs`, replacing the hand-made `*-units-backup-*.json` files.
  Re-pointed 3D bindings are listed in the stored report's `rebound`.
- **Dry run.** `?dryRun=true` answers 200 with the full report — refusals
  included — and writes nothing, not even the project link. The first sync of each
  property is a dry run.
- **The report lists everything removed or unmatched:** per building `removed`
  (with photos, pin and whether a 3D shape is bound), `absorbed`, `movedIn`/
  `movedOut` and `unknownStatus`; and `untouched`, `staleLinks` and
  `unmatchedTrackerBuildings` (with their rows) for the property. `counts` tallies
  them.
- **The tracker logs a warning** with those counts whenever a push it sent comes
  back 200 with anything removed, unmatched, unknown or refused — including every
  dry run. Website buildings the tracker simply lacks (Centro's Building 10), and
  tracker buildings with no units, are not warned about, or every hourly push
  would warn.
- Website buildings the tracker does not list are left exactly as they are, and
  tracker buildings with no website building are reported, not created — a
  building needs its plan artwork before it can be shown.

## Rollout of Phase 1

1. Apply website migration `00000000000014_tracker_sync.sql` and tracker
   migration `20261023000000_project_website_slug` (each is additive; the
   tracker's deploy runs `prisma migrate deploy` itself).
2. Deploy the `fix/sync-safety` changes: **the website API first**, then the
   tracker. The website must accept snapshot version 2 before the tracker sends it.
3. Point the tracker at the website **in dry-run mode**. Set the SSM parameters
   the tracker's `deploy.sh` reads, then redeploy the tracker API:
   - `/prime-tracker/WEBSITE_SYNC_SECRET` = the value of
     `/prime-tracker/website/TRACKER_SYNC_SECRET`, the secret the website API
     already reads (created by `scripts/aws/01-database.sh`). Copy the value; do
     not generate a new one.
   - `/prime-tracker/WEBSITE_SYNC_URL` =
     `https://dtw8rs0oq8bpp.cloudfront.net/api/integrations/tracker/snapshot?dryRun=true`

   The query is part of what is signed, so every push the cron sends is a dry
   run: the website answers with its report and writes nothing. **Not** the Render
   API — it still runs and would accept the push into the wrong database with no
   error.
4. Set Centro Plaza's `websiteSlug` to `centro-plaza` on project
   `cmtiyjnbg01bdh360e0mfslii` (`PUT /api/projects/<id>` with
   `{ "websiteSlug": "centro-plaza" }`).
5. Preview what leaves the tracker: `GET /api/website-sync/projects/<id>/snapshot`.
   Reconcile it against the tracker's header (appendix A of
   `website-audit-2026-10-27.md` has the SQL).
6. Read the dry-run report: `POST /api/website-sync/projects/<id>/push` returns it
   (the URL already carries `dryRun=true`), and the tracker's log has a warning
   with its counts whenever it lists anything. A clean report has `refused: null`,
   nothing under `removed`, `unmatchedTrackerBuildings`, `staleLinks` or
   `unknownStatus`, and `totals.after` equal to the tracker's header (54/47/7 for
   Centro today). Anything else is fixed at its source — a building name, a unit
   number, a missing website building — before going on. The one exception is a
   difference that is right (a unit really gone): go on to step 7 and apply it with
   one manual `POST …/push?force=true`. While the URL carries `dryRun=true`, even a
   forced push is only a dry run.
7. **Only after a clean dry-run report**, drop `?dryRun=true`: set
   `/prime-tracker/WEBSITE_SYNC_URL` to
   `https://dtw8rs0oq8bpp.cloudfront.net/api/integrations/tracker/snapshot` and
   redeploy the tracker API. The cron pushes for real within five minutes.
8. Publish the other projects one at a time, each read in a dry run first. The
   cron pushes a project within five minutes of its slug being set, so put
   `?dryRun=true` back on the URL for that window, or accept that only what the
   guards allow is written before you read it. Leander, Rio Ranch and Cap Rate need
   their website buildings created first, or the push is refused as partial.

Verified before rollout, without touching either database: the tracker's snapshot
built from the 16 Sep Centro Plaza reading, signed, verified and validated by the
website, and merged into today's CMS shape gives **54 / 47 / 7** — the tracker's own
header — keeps unit 908's four photographs, and a second run changes nothing.

Re-verified on 27 Oct 2026 against a public GET of the live Centro record: a
snapshot equivalent to today's data, version 1 or 2, changes nothing but
`trackerUnitIds`, `trackerBuildingId` and the `tracker` sub-objects, keeps 54/47/7
and every binding, and a second push after a jsonb round trip reports no change.

## Phase 2 — move the website onto the tracker's AWS account

All in the tracker's Terraform, not the console. `infra/terraform/website.tf`
(written, validated, **not applied**) adds the website's S3 bucket, CloudFront
distribution and apex + `www` records behind a new `enable_website` switch, off by
default.

0. **Prerequisites.** Confirm the tracker runs in the client's own AWS account
   (`docs/AWS_ACCOUNT_SHIFT.md` in the tracker repo), then delegate
   `theprimedeveloper.com` to Route 53 and set `enable_dns = true`.
1. **Server.** t3.micro → t3.small: two Node processes, Redis and nginx do not fit
   in 914 MiB.
2. **Storage.** Copy the Supabase `images`, `models` and `documents` buckets into
   the tracker's `media` bucket under `website/`, served by the existing media
   CloudFront distribution. Replace Supabase's on-the-fly resizing
   (`apps/web/src/lib/images.js` uses `/storage/v1/render/image/`) with sizes
   generated at upload by sharp, plus a one-off backfill. Rewrite every stored
   Supabase URL — `content`, `properties.image/gallery/detail`, `news.cover_image`
   — and the three hard-coded ones in `apps/web/src`. Port the tracker's
   `common/storage/s3.driver.ts`.
3. **Database.** Create `prime_website` and its user on RDS; `pg_dump` the website
   tables from Supabase (`--no-owner --no-acl`) and restore from the EC2 host over
   SSM, since RDS is private. Freeze CMS edits for the cutover; compare row counts.
4. **API.** Run the website API on the EC2 host behind nginx, deployed by the same
   SSM pipeline as the tracker. Ends Render's cold starts and the Singapore → Ohio
   round trip.
**Status 25 Oct 2026: Firebase Hosting is retired.** Its three sites
(`dev-theprimedevelopers`, `theprimedeveloper`, `theprime-construction`) are disabled,
and the website is served only from AWS, at https://dtw8rs0oq8bpp.cloudfront.net until the domain moves.
The Render API still auto-deploys from `main` but no site calls it any more.

**Status 23 Oct 2026: steps 2–5 are live on the preview address.** The website
API runs on the tracker's EC2 host (PM2 `prime-website-api`, `:3002`) against
`prime_website` on RDS, reached as `<site>/api` through CloudFront; uploads and
originals are in the website bucket's `media/`; `/api/img/...` replaces Supabase's
resizer. Scripts: `scripts/aws/01-database.sh`, `02-deploy-api.sh`,
`03-copy-content.sh` (content, properties, news and public files — re-run at
cutover), then `scripts/deploy-web-aws.sh`. **Not moved:** admin accounts and
leads (so the CMS cannot be signed in to on AWS yet), SES, and the domain.

5. **Front end — preview live since 23 Oct 2026.** `website.tf` was applied with
   `enable_website = true` (6 resources, nothing existing touched): bucket
   `prime-tracker-website-056836825737`, CloudFront `E25N0DCCIGFVRS` at
   **https://dtw8rs0oq8bpp.cloudfront.net**. Deploy with
   `pnpm run build:web && scripts/deploy-web-aws.sh`. The site loads its content
   only once that origin is in the Render API's `CORS_ORIGINS`.
   `theprimedeveloper.com` still serves the client's 2023 PHP site, and its DNS
   zone is not in this AWS account — moving the apex is the client's go-live call.
   Still to add: a GitHub Actions deploy role for this repository (the tracker's
   OIDC role trusts only `kalyan1421/prime-tracker`).
6. **Email.** Lead notifications through SES, already provisioned.
7. **Cutover.** Switch DNS; keep Supabase, Firebase and Render read-only for two
   weeks, then shut them down.

Estimated extra cost: roughly $10–15 a month over the tracker's current bill.

## Open questions for the client

- How should `UNDER_CONTRACT` and `LEASE_PENDING` units show on the website?
- The 16 Sep Centro Plaza sync copied individual buyers' names onto sold units
  (e.g. 205, 206, 804). The new sync never sends buyers and leaves sold units'
  tenant text alone — should those names be removed from the CMS?
- Which tracker projects should appear on the website, and under which slugs?
