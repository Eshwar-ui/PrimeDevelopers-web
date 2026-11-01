# Audit, 1 Nov 2026: sync status, 3D tagging, security, architecture, code review

Read-only review of `main` at 681da20, plus the 3D tagging changes that ship
in the same pull request as this folder. Detailed reports:

- [security-audit.md](security-audit.md): `security-and-hardening` checklist, 0 critical, 2 high
- [architecture-review.md](architecture-review.md): risks ranked, ADR-001 on unit-detail precedence
- [code-review.md](code-review.md): `engineering:code-review` + `engineering:debug`, 2 high, 6 medium

Line numbers in those reports are for 681da20. Items marked **fixed** below are
fixed by this pull request, not at 681da20.

## 1. Is Prime Tracker connected to the website?

Built on both sides and deployed, but **not connected**. No push has ever been
applied to the live site. A public `GET /api/properties/centro-plaza` on 1 Nov
showed:

- `trackerProjectId: null`
- `trackerSyncedAt: null`
- no `detail.trackerCounts`
- no unit row carrying `trackerUnitIds`

Centro's 54/47/7 still comes from the manual 16 Sep mirror script.

**Why: the tracker's push is switched off.** Checked in SSM on 1 Nov (account
056836825737, us-east-1):

- `/prime-tracker/WEBSITE_SYNC_URL` is a String whose value is `REPLACE_ME`.
- `/prime-tracker/WEBSITE_SYNC_SECRET` is a SecureString. Its value was not read.

Both are version 1, created 25 Oct 10:40 IST and never changed. The tracker's
`WebsiteSyncService.target()` returns null for a URL that isn't `http(s)://…`,
so it sends nothing — not even dry runs. The website's side
(`/prime-tracker/website/TRACKER_SYNC_SECRET`) has existed since 23 Oct.

To switch it on, follow rollout steps 3–7 in
[tracker-sync-and-aws-plan.md](../tracker-sync-and-aws-plan.md): copy the
website's secret into `WEBSITE_SYNC_SECRET`, set the URL with `?dryRun=true`,
redeploy the tracker API, and read the dry-run report.

How it works once it is on (design: [tracker-sync-and-aws-plan.md](../tracker-sync-and-aws-plan.md)):

```
Tracker RDS ─► tracker cron (5 min, forced hourly) ─► signed POST /api/integrations/tracker/snapshot
           (public-safe fields only)                    │ HMAC(timestamp.path?query.body), ±5 min
                                                        ▼
                         website merge (guards, 409 on mass removal, dry run) ─► properties.detail
                                                        ▼
                                   public site + 3D viewer, CMS admin (tracker fields locked)
```

Before the dry run comes off, fix code-review M1–M3 and architecture P0
(below).

## 2. 3D: buildings first, then units; details from the tracker, the CMS as fallback

Changed in `apps/web`:

- **Steps.** The whole-site tagging panel (`SiteModelManager.jsx`) has three
  steps: 1 Buildings, 2 Units, 3 Roads.
- **Step 2 is gated by step 1.** It only opens a building that step 1 gave
  shapes to. The rest of the site dims. A tap on a shape outside that building
  is refused, with a note saying where the shape belongs.
- **Untagging keeps the building.** Untagging a unit puts its shape back in the
  building rather than leaving it untagged. Re-tagging a building in step 1
  keeps the units already tagged inside it.
- **Unit details.** Fields the tracker sync writes are locked. Fields it has no
  data for stay editable in the CMS. Size is locked only once the tracker has
  a square footage. Tenant is locked only while the sync clears it or a lease
  names one. This is `trackerOwnedFields()` in `unitChecks.js`, which mirrors
  `mergeRow()` in the API.
- **Tracker-linked buildings.** These have `trackerBuildingId`. They show
  Tracker/CMS badges and don't offer "Add unit" or tap-to-create, because the
  next sync would delete those rows, or refuse the whole push.

### Fixed along the way

- **Admin clicks on tagged shapes did nothing.** A tap on a tagged shape went to
  a no-op `onSelect`. Untag-by-click, re-tagging, and picking a unit inside a
  tagged building all appeared to work but did nothing (`ModelViewer.jsx`).
- **Renames dropped 3D links (code-review H2).** Renaming a building or unit
  dropped its 3D links. `markOriginalLabels`/`rekeyForSave` are now wired into
  `PropertyEditPage`. The Units page re-keys site bindings on rename.
- **Building 9 counted as untagged.** Every one of its shapes is a unit, so the
  step 1 summary counted it as "not yet tagged".
- **The camera reset after every tag (code-review M4).** It now keeps the same
  bounds when a rebuild doesn't move them. The scene itself still rebuilds on
  each tag.

Verified:

- 35/35 web tests and 75/75 API tests pass.
- The Vite build passes.
- The admin flow was driven in the browser pane against a fetch stub, so no
  write reached production.
- A building rename was checked in the captured PATCH bodies: 20/20 building
  and 20/20 unit bindings carried across two consecutive saves.

## 3. Open findings, in priority order

| # | Finding | Where | Source |
|---|---|---|---|
| 1 | An upload after 15 idle minutes logs the editor out and loses unsaved edits | `apps/web/src/lib/api.js:210-239` | code-review H1 |
| 2 | Public property GET serves the whole `detail` blob: buyer-shaped names on 35 sold rows, two lease rates, and tracker internals once the sync is on | `properties.service.ts:16-31` | security H1, architecture 4 |
| 3 | The leaked JWT secret is still the local and Render value. Render still auto-deploys from `main` | `render.yaml:52,112` | security R1 |
| 4 | The sync bumps `updatedAt`. Open editors then 409, and "Save anyway" reverts the sync for up to an hour | `tracker-sync.service.ts:51-111` | architecture 2 |
| 5 | A tracker split points both shapes at the first half. A cross-building move leaves `buildingBindings` behind. The undo record has no site model | `tracker-merge.ts:758-784,927-933`; `tracker-sync.service.ts:84-93` | code-review M1–M3 |
| 6 | A refused push is recorded and alerted nowhere, so statuses freeze silently | tracker `website-sync.service.ts` | architecture 3 |
| 7 | The brochure endpoint fetches any CMS URL (SSRF), and visitor text is mailed from the company domain | `leads.service.ts:225-233` | security M1–M2 |
| 8 | A tracker user with `project:edit` can claim any unlinked property by slug | `tracker-sync.service.ts:120-140` | security M3 |
| 9 | CSP is still Report-Only | tracker `website.tf:269` | security M4 |
| 10 | Any refresh failure (a 502 during a deploy) counts as a logout | `api.js:118-145` | code-review M5 |
| 11 | `606+608` can't be clicked in 3D even though shapes tagged 606 and 608 exist | `siteModel.js` `reconcileSite` | code-review M6 |
| 12 | Local dev can't load any 3D model: CDN `/media` sends no CORS headers | `deploy-web-aws.sh` / CloudFront | found while verifying |
| 13 | The Units page "Add unit" still allows new rows in tracker-linked buildings | `UnitEditPage.jsx` | architecture 3 |

Also: brochure emails never send (every flyer value is `"#"`), Firebase
Analytics contradicts the privacy policy, and the JSON body limit is 100 KB
against a 59 KB Centro record.
