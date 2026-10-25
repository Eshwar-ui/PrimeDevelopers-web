# Prime Tracker → website unit sync, and the move to AWS

Status: **Phase 1 built on branches, not deployed.** Written 23 Oct 2026.

- Website: `PrimeDevelopers-web` branch `feat/tracker-unit-sync`
- Tracker: `prime-tracker-main` branch `feat/website-sync`

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

### Payload (version 1)

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

### Who owns which field

| Field on a website unit row | Owner |
|---|---|
| `label`, `status`, `trackerUnitIds` | Tracker |
| `size` | Tracker when it has a sqft; otherwise the website's value stays |
| `tenant` | Tracker for leased units; cleared when a unit becomes available; **left alone on sold units** |
| `images`, `description`, `x`/`y`, `logo`, `rate`, `floor`, `frontage`, `tenantUrl`, `tenantCategory`, `facingRoad` | Website |

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

### Safety

- **Removal guard.** A snapshot that would remove more than a quarter of a
  property's unit rows (and more than three) is refused with HTTP 409 and the
  report, unless it is sent with `?force=true`. A broken tracker query must not
  empty the site.
- **Every applied sync stores the previous `floorPlans` and totals** in
  `website_tracker_syncs`, replacing the hand-made `*-units-backup-*.json` files.
- **Dry run.** `?dryRun=true` returns the full report without writing. The first
  sync of each property should be a dry run.
- Website buildings the tracker does not list are left exactly as they are, and
  tracker buildings with no website building are reported, not created — a
  building needs its plan artwork before it can be shown.

## Rollout of Phase 1

1. Apply website migration `00000000000014_tracker_sync.sql` and tracker
   migration `20261023000000_project_website_slug` (each is additive; the
   tracker's deploy runs `prisma migrate deploy` itself).
2. Generate one secret (`openssl rand -hex 32`); set `TRACKER_SYNC_SECRET` on the
   website API (Render dashboard) and the SSM parameters
   `/prime-tracker/WEBSITE_SYNC_SECRET` and `/prime-tracker/WEBSITE_SYNC_URL`
   (`https://prime-developers-api.onrender.com/api/integrations/tracker/snapshot`),
   then redeploy both. `ssm.tf` and `deploy.sh` already know the two parameters.
3. Set Centro Plaza's `websiteSlug` to `centro-plaza` in the tracker
   (`PUT /api/projects/<id>` with `{ "websiteSlug": "centro-plaza" }`).
4. Preview what leaves the tracker: `GET /api/website-sync/projects/<id>/snapshot`.
5. Dry run: `POST /api/website-sync/projects/<id>/push?dryRun=true` and read the
   website's report — which rows would be removed or relabelled, and the totals.
6. Push for real (the cron does it within five minutes). Then publish the other
   projects one at a time, each with a dry run first.

Verified before rollout, without touching either database: the tracker's snapshot
built from the 16 Sep Centro Plaza reading, signed, verified and validated by the
website, and merged into today's CMS shape gives **54 / 47 / 7** — the tracker's own
header — keeps unit 908's four photographs, and a second run changes nothing.

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
