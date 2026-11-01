# Code review and bug hunt: Prime Developers website, 1 Nov 2026

**Scope:** read-only review of HEAD `681da20` on `main`.
- Method: five-axis review (correctness, readability, architecture fit, security, performance) plus a bug hunt. Each bug was reproduced with a harness or traced through the code, its location pinned down, and its root cause explained.
- Nothing in the repo was modified. Nothing connected to the database.
- One public GET was made, of `https://dtw8rs0oq8bpp.cloudfront.net/api/properties/centro-plaza`, to measure the live record and reconcile its bindings. It is the same request any visitor makes.

**Not repeated:** items already fixed per `docs/website-audit-2026-10-27.md` and the wave-1 commits (`c5c2ede`, `2f69830`, `bb00d47`, `0b9d8f3`, `05b3343`, `0cd1207`, `04738e7`, `cb4c90e`).

**Line numbers:** they are for HEAD.
- Another agent has uncommitted edits to `PropertyEditPage.jsx`, `BuildingBlock.jsx`, `unitsStore.js`, `SiteModelManager.jsx`, `ModelViewer.jsx`, `siteModel.js` and others. They are reviewed separately under "In-flight work".

## Test results

| Suite | Command | Result |
|---|---|---|
| API (node:test, Prisma and SES faked) | `pnpm --filter @prime-developers/api test` (run with `DATABASE_URL` overridden to an unreachable address as a guard) | **75 / 75 pass**, 0 fail, 0 skipped |
| Web (node:test) | `pnpm --filter @prime-developers/web test` | **29 / 29 pass**, 0 fail |
| API typecheck | `npx tsc --noEmit -p apps/api/tsconfig.json` | clean |
| Web lint | `npx oxlint` (apps/web) | 0 errors; 3 non-trivial warnings (unused `setCompareMode` in FloorPlanSection.jsx:71, unused param in CountUp.jsx:28, needless `size` dep in ModelViewer.jsx:1132) |

- No test needed a database, so none were skipped.
- The suites are green, but two of the bugs below sit exactly where tests are missing:
  - `units.test.js` covers `rekeyForSave`, which production at HEAD never calls.
  - No merge test covers a split, or a cross-building move, together with site-model bindings.

**Harnesses** (in the scratchpad):
- `head/h1.mjs`: CMS rename against the Centro fixture.
- `head/h2.mjs`: live Centro reconcile.
- `head/h3.mjs`: upload with an expired token.
- `harness/merge-harness.ts`: merge edge cases.

---

## Findings by severity

### HIGH

#### H1. An image or model upload after 15 idle minutes logs the admin out and throws away unsaved edits
- **Where:**
  - `apps/web/src/lib/api.js:237-239`: `ensureFreshSession` refreshes only when `!accessToken`.
  - `api.js:210`: 401s on FormData requests are never retried.
  - `api.js:216-218`: on any other 401 it clears tokens and fires `onAuthLost`.
  - `apps/web/src/lib/uploads.js:70`.
  - `apps/web/src/admin/RequireAuth.jsx:13-15`.
- **Scenario:**
  1. The admin opens Centro in the property editor and types descriptions for 20 minutes. Editing makes no API calls, and production sets `JWT_ACCESS_EXPIRY=15m` (`scripts/aws/02-deploy-api.sh:81`).
  2. They upload a unit photo.
  3. `ensureFreshSession()` does nothing, because the expired token is still non-null.
  4. `POST /uploads/image` returns 401. Because the body is FormData there is no refresh, so `clearTokens()` and `onAuthLost()` run.
  5. RequireAuth renders `<Navigate to="/admin/login">` and the editor unmounts.
- **Result:** every unsaved edit is gone. LeaveGuard catches only link clicks and `beforeunload`, not this navigation.
- **Confidence:** confirmed by harness (`head/h3.mjs`).
  - The upload path made one request, got a 401, and `authLost` fired.
  - A JSON PATCH under the same conditions refreshed and retried successfully.
- **Fix:**
  - FormData *can* be re-sent by `fetch`; it is not a stream, so the comment at `api.js:207-209` and `uploads.js:68-69` is wrong. Allow the refresh-and-retry for FormData.
  - Make `ensureFreshSession` decode the JWT `exp` and refresh when it is under ~30 s away.
  - See M5 for not unmounting editors when the session is lost.

#### H2. At HEAD, a CMS rename of a unit or building breaks its 3D link; a building rename removes the building from the 3D view
- **Where:**
  - `apps/web/src/lib/units.js:461-483`: `applyUnitChange` re-keys only `building.model.bindings`, the per-building model, which no Centro building has.
  - `units.js:500`: "Not wired yet".
  - `BuildingBlock.jsx:56,60-61,73`: the building label goes through `setField('building')` with no re-key.
  - `unitsStore.js:84`.
  - `PropertyEditPage.jsx`: no `markOriginalLabels` at load (~l.110) and no `rekeyForSave` in `save`.
  - `rg` at HEAD finds no caller of `markOriginalLabels`, `rekeyForSave` or `rekeySiteBindings` outside `units.js`.
- **Scenario, using live Centro data:**
  - **Unit rename (605 → 605A), from the Units page or the editor:** `siteModel.unitBindings` still says `605`. Unit entries drop from 27 to 26, and 605A appears as "Not placed".
  - **Building rename ("Building 6" → "Building Six"):** Building 6 resolves **0 of its 20 shapes**.
    - No fallback can match, because both `unitBindings[*].buildingLabel` and `buildingBindings` name the old label.
    - Building 6 drops off the 3D chip rail, and its shapes become unclickable scenery.
- **Confidence:** confirmed by harness (`head/h1.mjs`, against the HEAD copies of units.js and siteModel.js).
- **Status:** the working tree now has uncommitted wiring by the other agent (PropertyEditPage, BuildingBlock with `{ rebind: false }`, unitsStore with `rekeySiteBindings`). See "In-flight work" for review notes. Until that lands and deploys, the bug is live.
- **Fix:** what the in-flight change does. In addition:
  - Add a component-level test that a rename through `propertyPayload(rekeyForSave(...))` keeps `reconcileSite` resolving the unit.
  - Use the same approach in any other place that edits labels: the side panel in SiteModelManager, and tap-to-tag.

### MEDIUM

#### M1. A tracker split points every shape of the combined row at its first half
- **Where:** `apps/api/src/modules/tracker-sync/tracker-merge.ts:927-933` (rekey pushed for a relabelled primary) and `:758-784` (`rekeySiteBindings`).
- **Scenario:**
  1. Website row `606+608` (tracker ids `u606`, `u608`) has meshes `m606` and `m608`, both tagged to `606+608`. The new building-first tagging flow makes this a likely state.
  2. The tracker sends `606` LEASED and `608` AVAILABLE as separate units.
  3. The merge relabels the primary `606+608` → `606` and re-keys **both** meshes to `606`.
- **Result:**
  - The physical 608 storefront lights up as "606 · Leased".
  - The available unit 608 has no shape, so a visitor clicking 608's shopfront is shown the wrong unit.
  - The same root cause copies the combined row's 2D pin onto both halves; `tracker-sync.test.ts:531` asserts that today.
- **Confidence:** confirmed by harness (`merge-harness.ts` case A). Output: `m606 → 606, m608 → 606`.
- **Fix:**
  - When the new label's parts are a strict subset of the old label's parts (a split), do not re-key. Leave the bindings stale; they fall back to the building.
  - Report `needsRetag: [{mesh, was}]`, or re-key by part only when a mesh's binding names exactly one part.
  - Clear the duplicated pin on the non-primary half.

#### M2. A cross-building move re-points the 3D shape into the other building, and leaves the two binding maps disagreeing
- **Where:** `tracker-merge.ts:931-933` (rekey on `primary.b !== b`) and `:769-776`. Only `unitBindings` is rewritten; `buildingBindings[mesh]` is never touched.
- **Scenario:**
  1. Tracker unit `u605` moves from Building 6 to Building 8 as `821`.
  2. The result is `unitBindings.m605 = {Building 8, 821}` while `buildingBindings.m605 = 'Building 6'`.
- **Result:**
  - The viewer resolves a mesh that physically sits in Building 6 as Building 8's unit. Focusing Building 8 frames a box spanning both buildings.
  - The merge clears the 2D pin on a move because "it was a point on the old building's plan", yet keeps the 3D shape, which is just as physically fixed. The two rules contradict each other.
  - The in-flight `meshBuilding()` in siteModel.js reads `buildingBindings` first, so the admin's step-2 gate would call the mesh Building 6's while visitors see it as Building 8's.
- **Confidence:** confirmed by harness (case B). `tracker-sync.test.ts:707` asserts the re-point.
- **Fix:** on a cross-building move (and an absorb into another building at `:989-991`), drop the unit binding so the mesh falls back to its building, and report it for re-tagging. At minimum, keep `buildingBindings` consistent.

#### M3. The sync's undo record leaves out the site model, so restoring after a push that re-keyed shapes breaks the 3D links
- **Where:**
  - `tracker-sync.service.ts:84-93` stores `previousFloorPlans` and `previousTotals` only.
  - `nextDetail` (`:24-35`) rewrites `detail.siteModel` whenever `report.rebound.length > 0`.
  - `schema.prisma` says "Writing previousFloorPlans and previousTotals back undoes the sync".
- **Scenario:**
  1. A push relabels 605 → 605A and re-keys `m605` to `605A`.
  2. Someone restores `previous_floor_plans`, so the label goes back to `605`.
  3. The binding still says `605A`, so the shape is stale.
  4. `trackerCounts` is not restored either.
- **Confidence:** traced, not run.
- **Fix:** store `previousSiteModel` (and `previousTrackerCounts`) in `website_tracker_syncs` (additive migration), or store the whole previous `detail`.

#### M4. The admin's 3D tagging view rebuilds the whole scene and snaps the camera back to default on every keystroke and every tag
- **Where:**
  - ModelViewer.jsx:307: the `meshes` memo depends on `siteEntries`.
  - `:241`: vertex grouping over all scenery runs in binding mode.
  - `:456-470`: `onReady` fires on every `meshes` change.
  - `:1659-1661`: `setBounds(payload.bounds)` sets a new object each time.
  - `:1142-1145`: `frameDefault()` runs on every `bounds` change.
  - SiteModelManager.jsx:64-65, 636, 643, 819: `entries` is rebuilt whenever `buildings` or `model` change.
- **Scenario:**
  1. In the admin, the admin types in the unit side panel (UnitFields → `onChangeUnit` → `onBuildingsChange`), or tags a shape (`bindSiteMeshes` → `setModel`).
  2. `reconcileSite` builds a new array, so `siteEntries` changes.
  3. That triggers `scene.clone(true)`, bounds recomputed for 364 meshes, vertex-key grouping across all scenery, and 364 materials disposed and recreated.
  4. `onReady` then fires with new bounds, and the camera resets to default.
- **Result:** the very regression ModelViewer's own comment at `:430-435` says must not happen. Tagging Building 6's twenty units means re-zooming twenty times, with input lag on every keystroke.
  - On the public site `siteEntries` is stable, so visitors are unaffected.
- **Confidence:** traced through the code. Not reproduced, because WebGL screenshots in the Browser pane are black.
- **Fix:**
  - Key the memo on a stable string of the addressable mesh names, not the entries array. In binding mode addressability does not matter, since nothing is merged.
  - Emit `onReady` only when the scene or the rotation changes, or compare bounds by value before calling `setBounds`.

#### M5. Any refresh failure, a transient one included, counts as a logout and unmounts open editors
- **Where:**
  - `api.js:118-145`: a catch-all in `refreshSession` covers network errors and 5xx (e.g. a pm2 restart during `02-deploy-api.sh`), then calls `clearTokens()` and `onAuthLost()`.
  - `AuthContext.jsx:29-35`: any `/auth/me` failure at startup clears the marker.
  - `RequireAuth.jsx:13-15`: navigates away.
- **Scenario:**
  1. The API is redeployed while the admin is editing.
  2. The next request's refresh gets a 502 or a network error.
  3. The admin is logged out and the form is lost. In cookie mode the refresh cookie is still valid.
  4. On reload, the cleared marker means no restore is even attempted, so the admin must sign in again.
- **Confidence:** traced.
- **Fix:**
  - Only a 401 from `/auth/refresh` means the session is lost; on network errors or 5xx, keep the tokens and throw an ApiError with status 0.
  - Show re-login as a modal over the editor rather than a route change, or stash the dirty form in `sessionStorage` and restore it.

#### M6. Stale Centro bindings: what the viewer does today, and the cheap fix
This answers the question about Building 6 (bindings 601–620, rows only `605` and `606+608`) and Building 10 (bindings 1001–1009, no rows).

**Live reconcile with HEAD siteModel.js** (`head/h2.mjs`):
- 102 shapes resolve, 28 of them as units.
- 30 bindings are stale: 19 in Building 6, 9 in Building 10, and Building 8's 812 and 814.
- **None are dead.** All 58 unit-bound meshes also carry a `buildingBindings` entry, so each stale mesh falls back to `kind: 'building'` (siteModel.js:101-127).
- All nine buildings appear as chips, Building 10 included, with 0 units.

**Remaining defects:**
1. `606+608` is listed as unmodelled. The meshes tagged `606` and `608` (its two physical halves) show as building shell, so the row cannot be clicked in 3D. Selecting it from the list only frames the whole building. Exact-match lookup is at `units.js:144-148` and `siteModel.js:103`.
2. Inside Building 6, tapping any of the 19 fallback shapes runs `openBuilding` (`SiteModelSection.jsx:287-295`). That clears the selected unit and re-frames the building, instead of doing nothing or picking the shape's unit.
3. Building 10 is a focusable building with an empty panel. This is a client decision already listed in the audit.

**Confidence:** confirmed on live data.

**Fix:**
- When the exact label misses, resolve to the row in the same building whose `unitLabelParts` include the binding's label. Two of the 30 stale bindings (`606`, `608` → `606+608`) are rescued at no cost, and the row lights up both halves.
- When a fallback building shape is tapped inside the focused building, ignore it rather than resetting the selection.

### LOW

#### L1. The JSON body limit is express's 100 KB default, and the whole-record PATCH is already about 60 KB
- **Where:** `main.ts:12` (`rawBody: true`, no `json` limit).
- The live Centro record is 59,417 bytes, `detail` alone 44.5 KB. The property editor and the Units page PATCH the whole `detail`.
- Photos for the 18 units that have none, plus descriptions and FAQs, put this within reach of a 413 "request entity too large" that the editor shows raw.
- **Confidence:** measured.
- **Fix:** `app.useBodyParser('json', { limit: '512kb' })`. Do it alongside rawBody, and keep a cap. Longer term, add the per-unit PATCH from phase 2 of the audit.

#### L2. The first-time building match by trailing number is loose, and its result becomes permanent
- **Where:** `tracker-merge.ts:501-502` and `:954`.
- **Scenario:** the tracker's "Phase 2 Pad 6" pairs with the website's "Building 6" by number. After the first real push it is stored as `trackerBuildingId`, and that link is never re-matched.
- **Confidence:** confirmed by harness (case E).
- **Fix:** require a dry run that shows `matchedBy: 'number'`, or only accept a number match when the tracker name contains "building", "bldg" or "b-".

#### L3. Every push re-sorts unit rows by label, so the CMS's manual order is undone and the first push after a reorder is always a write
- **Where:** `tracker-merge.ts:437` and `:896-947`. BuildingBlock.jsx:117-125 still offers move up and down on synced buildings.
- **Confidence:** confirmed by harness (case D): `changed: true`.
- **Fix:** keep prior order for continued rows and append new ones; or hide reordering on tracker-linked buildings.

#### L4. In the brochure email with an attachment, the text part is one unwrapped base64 line
- **Where:** `mail.service.ts:141`. The attachment is wrapped at 76 characters (`:153`); the body is not.
- With a 1–2 KB overview the line exceeds RFC 5322's 998-character limit, which some MTAs reject or mangle.
- **Confidence:** plausible, not sent (SES is sandboxed).
- **Fix:** wrap the body the same way as the attachment.

#### L5. The brochure fetch can be used to exfiltrate data by email if the CMS is compromised
- **Where:** `leads.service.ts:225-231`. A visitor makes the server fetch `detail.overview.flyer`, a free-text CMS URL, and the response comes back as an attachment to an address the visitor chooses.
- IMDSv2 blocks the metadata service, but any service on localhost or the VPC with unauthenticated GETs is reachable, the tracker API on the shared EC2 for example.
- **Confidence:** plausible. It requires admin write access.
- **Fix:** only fetch URLs under `MEDIA_PUBLIC_BASE` or the media bucket, and check `content-type` is `application/pdf`.

#### L6. A unique-constraint violation (duplicate slug) comes back as 500
- **Where:** `properties.service.ts:33-35` and `:53-57/78-83` (also news). There is no filter for Prisma P2002, so the admin sees "Internal server error".
- **Fix:** map P2002 to a 409 with "slug already in use".

#### L7. The sync checks for a slug conflict before taking the row lock, and never re-checks after
- **Where:** `tracker-sync.service.ts:53-55, 77`.
- **Scenario:** two first pushes for different projects with the same slug, in a race. The second merges into a property the first just linked, because `link = {}` once `trackerProjectId` is set.
- Unlikely if the tracker keeps `websiteSlug` unique.
- **Fix:** after `FOR UPDATE`, refuse when `current.trackerProjectId` is set and differs from `snapshot.project.id`.

#### L8. Nothing makes snapshot order monotonic
- An older snapshot (a delayed retry, or a second tracker instance) applied after a newer one rolls statuses back within the 5-minute signature window.
- **Fix:** store the last applied `generatedAt` per property and refuse an older one (allow it with force).

#### L9. Per-building models: re-keying on every keystroke still strands bindings
- **Where:** `units.js:461-483`. Clearing a label to empty and retyping it loses the link, because the `!nowLabel` and `!wasLabel` guards skip the re-key. The same applies when an explicit binding collides with another unit's label mid-edit.
- Latent: no live building has a per-building model. The in-flight change passes `{ rebind: false }` from BuildingBlock but not from every caller.

#### L10. The DB trigger overrides the API's `updatedAt`
- **Where:** `properties.service.ts:80-82`, `migration 1_updated_at_triggers`. The trigger sets `updated_at = now()` (transaction start), so `Math.max(Date.now(), current + 1)` is dead code and its comment is wrong.
- The equality check is still sound in practice. Delete the code or fix the comment.

#### L11. Privacy, tracker side (separate repo)
- `website-snapshot.ts` `occupantOf` on `fix/sync-safety` falls back to `lease.tenantName` when there is no brand. A sole-trader lessee's personal name would be published as `tenant`.
- This is a new route to the audit's existing privacy item about names on sold units, not a repeat of it.

#### L12. Test gaps
- No merge test covers a split with site bindings (M1), the buildingBindings after a move (M2), or the undo of a rebound push (M3).
- No web test covers the upload path with an expired token (H1).
- `units.test.js` tests unwired helpers, which gives false confidence until the wiring lands.

---

## In-flight work (uncommitted, another agent): review notes

Seen in `git diff` during this review, and expect it to change. All three items are edge cases, not blockers.

1. **The PropertyEditPage wiring looks right.**
   - It marks at load, re-keys into `sent`, re-marks the saved copy, and keeps a form edited mid-PATCH on its loaded markers.
   - Swaps and renames within one save are handled by `rekeyForSave`, which is already tested.
2. **unitsStore re-keys a rename onto a label that has stale bindings.**
   - `rekeySiteBindings({type:'renameUnit'})` in unitsStore re-keys even when the target label already has *stale* bindings in that building, and both PropertyEditPage and unitsStore inherit this.
   - Example: Building 6 still holds stale `604` and `610`. Renaming 605 → 604 makes both `m604` and `m605` resolve to the one row.
   - Warn when the target already has stale bindings, or skip the re-key.
3. **ModelViewer's onClick change is a correct fix for a HEAD bug.**
   - At HEAD, clicking an already-tagged shape in the admin went to `onSelect`, a no-op, so PR #23's "untag by clicking an armed shape" and re-tagging did nothing.
   - M4 still applies after it.

## What looks good
- **The merge is pure and well tested:**
  - jsonb key-order-safe comparison;
  - removal guards per building, plus a guard on rows with photos or pins;
  - an id-first matching cascade;
  - asking figures held back until the client approves publishing them.
- **The signature** covers path, query and timestamp, compares in constant time, and returns a 503 when the secret is unset.
- **Property saves** use a conditional PATCH under `FOR UPDATE`, consistent with the sync's lock.
- **Refresh rotation** is atomic (`updateMany where revokedAt null`), refresh is serialised across tabs with `navigator.locks`, and the cookie is HttpOnly, Strict and path-scoped.
- **Uploads** check magic bytes and decode with sharp; SVG is refused; folders are sanitised.
- **Leads** are written before any mail is sent, staff notification runs in the background, and spam is kept rather than dropped.

## Verdict
**Request changes:**
- H1 is a one-line-class fix with real data loss behind it.
- H2 is fixed in the working tree but not yet committed or deployed.
- M1, M2 and M3 should land before `WEBSITE_SYNC_URL` loses `?dryRun=true` for Centro.
