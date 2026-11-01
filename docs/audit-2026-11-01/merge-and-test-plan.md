# Merge, deploy and test plan — 1 Nov 2026

Covers every pull request opened from the 1 Nov audit. Written after re-reading
each session's report and re-running the tests listed under "Verified".

## 1. Where each piece stands

| Session | PR | State | Verified |
|---|---|---|---|
| Building-first 3D tagging + audit docs | [Eshwar-ui/PrimeDevelopers-web#26](https://github.com/Eshwar-ui/PrimeDevelopers-web/pull/26) | Open, mergeable | Web 35/35, API 75/75. Admin flow checked in the browser pane against a fetch stub |
| Admin logout on upload after idle | [Eshwar-ui/PrimeDevelopers-web#27](https://github.com/Eshwar-ui/PrimeDevelopers-web/pull/27) | Open, mergeable | Web 45/45 (16 new). Browser-checked against a local fake API |
| Tracker merge bugs (M1–M3) | [Eshwar-ui/PrimeDevelopers-web#28](https://github.com/Eshwar-ui/PrimeDevelopers-web/pull/28) | Open, mergeable | API 81/81, `tsc` clean. Adds migration `3_tracker_sync_site_bindings` (one nullable column) |
| Tracker: warn on stranded shapes | [kalyan1421/prime-tracker#42](https://github.com/kalyan1421/prime-tracker/pull/42) | Open, mergeable | `website-sync` specs 22/22 (re-run 1 Nov) |
| Public allowlist for the property API | [Eshwar-ui/PrimeDevelopers-web#29](https://github.com/Eshwar-ui/PrimeDevelopers-web/pull/29) | **Merged** (a514b5b), **not deployed** | API 89/89. The live API still sends `trackerProjectId` and 35 sold-unit tenants |

**A production data change was already made.** The #29 session rewrote the 35
sold-unit descriptions on Centro Plaza directly in the live `prime_website`
database: one transaction, run after a dry run and a backup. They now read
"Flex unit." (34) and "Retail unit." (1). The backup of the old text is
`.aws-stage/centro-plaza-before-sold-descriptions-2026-11-01.json`. It is
gitignored and still contains buyers' names and prices. Delete it once you no
longer need a way back.

**Integration check (1 Nov).** `main` + #26 + #27 + #28 merge with no conflicts.
On the combined tree:
- web tests 51/51;
- API tests 95/95;
- `tsc --noEmit` clean;
- `vite build` passes;
- `oxlint` reports no errors.

**There is no CI.** The only PR check is CodeRabbit, and it skipped. Every test
above was run by hand. Render still auto-deploys `main`. Its build doesn't run
migrations and nothing calls it, so merging #28 can't change the old database.

## 2. Merge order

Any order works: no two open PRs touch the same file. This order keeps each
merge's blast radius small:

1. **#26** (web: 3D tagging, admin unit locks, audit docs).
2. **#27** (web: auth refresh). Independent of #26.
3. **#28** (API: merge fixes and migration). It must be *deployed* before the
   sync's dry run comes off. It doesn't need to deploy before the web.
4. **kalyan1421/prime-tracker#42**, in any order. Merging to the tracker's `main`
   auto-deploys the tracker. Don't merge another tracker PR while that deploy
   runs; a second merge has cancelled a deploy before.

After each merge, pull `main` and run `pnpm -r test` (no CI will).

## 3. Deploy (one window, API before web)

0. **Before you start:**
   - Run `aws sso login --profile prime-client`.
   - Check that RDS isn't `backing-up`. The deploy's snapshot fails with
     `InvalidDBInstanceState` while it is.
   - Ask editors to save and close the CMS.
1. **API:** `scripts/aws/02-deploy-api.sh`. It takes an RDS snapshot, applies
   `3_tracker_sync_site_bindings`, then switches the release. It carries #29
   (public projection) and #28 (merge fixes).
2. **API smoke checks** (§5.1).
3. **Web:** `scripts/deploy-web-aws.sh`. It carries #26, #27 and #29's web
   changes (storefront strip, editor checkboxes).
4. **Web smoke checks** (§5.2).
5. **Rollback:** `scripts/aws/rollback-api.sh` for the API, and redeploy the
   previous commit for the web. The migration only adds a nullable column, so
   rolling the API back needs no down-migration.

Public responses are cached for up to about 6 minutes (`s-maxage=60`,
`stale-while-revalidate=300`). Wait that long before judging §5.1.

## 4. Sync go-live (a separate step, after §3)

Today `/prime-tracker/WEBSITE_SYNC_URL` is `REPLACE_ME`. Follow rollout steps
3–7 of [tracker-sync-and-aws-plan.md](../tracker-sync-and-aws-plan.md):

1. Copy `/prime-tracker/website/TRACKER_SYNC_SECRET` into
   `/prime-tracker/WEBSITE_SYNC_SECRET`.
2. Set `/prime-tracker/WEBSITE_SYNC_URL` to
   `https://dtw8rs0oq8bpp.cloudfront.net/api/integrations/tracker/snapshot?dryRun=true`.
3. Redeploy the tracker API.
4. Set Centro's `websiteSlug` to `centro-plaza` in the tracker.
5. Read the dry-run report. A clean report has `refused: null` and nothing
   under:
   - `removed`;
   - `unmatchedTrackerBuildings`;
   - `staleLinks`;
   - `unknownStatus`;
   - `stranded`.

   `totals.after` must be **54/47/7**.
6. Only then remove `?dryRun=true` and redeploy the tracker.

## 5. Testing strategy

### Pyramid, per area

| Area | Unit (exists) | Integration | End-to-end / manual | Gap |
|---|---|---|---|---|
| Tracker merge (#28) | Splits, combine→split, moves, undo, guards, status map | None against a real Postgres | Dry-run push (§4) | No test runs the migration, `FOR UPDATE` and a jsonb round trip on a real database |
| Signature (both repos) | Shared test vector in both suites | — | Dry-run push | — |
| Snapshot contract (tracker → website DTO) | Each side tests its own half | **None** | Dry-run push | No shared fixture proves the tracker's snapshot passes the website's DTO |
| Public projection (#29) | Every allowlisted field, withheld fields, opt-ins; `reconcileSite` on the projected copy | — | §5.1 GETs | — |
| Admin auth (#27) | 16 cases against a fake token-rotating API | — | Idle → upload on AWS (§5.2) | Cookie mode only ever checked against the fake API |
| 3D tagging (#26) | Binding helpers, ownership rule, Centro fixture | — | Stubbed browser pass (done); real model on AWS (§5.2) | Step gating lives inside `SiteModelManager`, with no component test |
| Public 3D viewer | `reconcileSite`/`toViewerEntries` on the Centro fixture | — | §5.2 | No automated render check (WebGL) |

### Coverage targets

Coverage is judged by business-critical branches, not by percentage:
- **Sync merge:** every status mapping, every refusal reason, every way a row
  can match, and every binding transition (rename, split, combine, move,
  remove). Met by #28.
- **Public projection:** every field on the allowlist, and every withheld field
  for each status. Met by #29.
- **Auth refresh:** each class of response (401/403 vs 5xx/429/network) for
  JSON and for FormData. Met by #27.
- **3D tagging:** each step's accept/refuse decision. **Not met.** Covered only
  by the manual stub run.

### Tests to add (the gaps)

1. **Step-2 gate.** Move the click decision out of `SiteModelManager` into a
   pure `decideMeshClick(state, meshName, block)`. Then:
   - *given* Building 6 is armed, *when* a Building 7 shape is clicked, *then*
     the result is "refuse" and names Building 7;
   - *given* nothing is armed, *when* a unit shape is clicked, *then* the
     result arms its building and its unit.
2. **Untag keeps the building.** *Given* a shape tagged as unit 605, *when* it
   is untagged on step 2, *then* `buildingBindings[shape]` is still
   "Building 6".
3. **Snapshot contract.** Build a snapshot with the tracker's `buildSnapshot()`
   from a fixture, then validate it with the website's `TrackerSnapshotDto`.
   *Then* it passes, and adding an unknown field fails. One fixture file,
   checked into both repos.
4. **Merge on a real database.** Run the service against Postgres in a
   container: apply all migrations, push, assert `previous_site_bindings` was
   stored, undo, assert the bindings came back.

### 5.1 API smoke checks (after step 1 of §3)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://dtw8rs0oq8bpp.cloudfront.net/api/health
```

```bash
curl -s https://dtw8rs0oq8bpp.cloudfront.net/api/properties/centro-plaza | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s),u=p.detail.floorPlans.buildings.flatMap(b=>b.unitList||[]);console.log({trackerProjectId:"trackerProjectId" in p,soldWithTenant:u.filter(x=>x.status==="sold"&&x.tenant).length,totals:[p.buildings,p.sold,p.available],unitBindings:Object.keys(p.detail.siteModel.unitBindings).length})})'
```

Expected: `200`, then
`{ trackerProjectId: false, soldWithTenant: 0, totals: [54, 47, 7], unitBindings: 58 }`.

### 5.2 Web smoke checks (after step 3 of §3)

**Public site.** On `/properties/centro-plaza`:
- the 3D model loads;
- 9 building chips show;
- drilling into Building 6 shows unit colours;
- the "established businesses" strip counts are unchanged.

**Admin** (you, signed in; **use Discard, never Save**). Open Centro, then
Floor plans & 3D:
- the steps read 1 · Buildings, 2 · Units, 3 · Roads;
- on step 2, Building 6 dims the rest of the site;
- clicking a Building 7 shape shows the refusal note;
- leave with Discard.

**Idle upload.** Sign in, leave the editor idle for 16 minutes, then add a
photo to a unit. You should stay signed in, with your typing still there.
Remove the photo and discard.

## 6. Recommendations

- **Add CI:** GitHub Actions on every PR running `pnpm -r test`, web `oxlint`
  and `vite build`, and API `tsc --noEmit`. Today nothing runs these.
- **Switch off Render's auto-deploy** (`render.yaml:52`). It still runs on the
  leaked JWT secret.
- **Confirm the description rewrite was intended**, and delete the backup file
  once it isn't needed.
