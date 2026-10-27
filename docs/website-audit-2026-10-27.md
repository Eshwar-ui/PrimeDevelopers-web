# Code Audit Report — Prime Developers website, 27 Oct 2026

**Stack detected:** Mixed.
- Front end: Vite + React 19 SPA, three.js / react-three-fiber.
- API: NestJS + Prisma on EC2, with Postgres on RDS.
- Hosting: S3 + CloudFront.
- Data source: Prime Tracker (NestJS + Prisma) pushes unit data to the site.

**Audit depth:** Full (security, architecture, scalability), focused on four areas:
- **[3D]** the site-model viewer
- **[Sync]** tracker → website unit matching
- **[CMS]** the admin's unit editing, images and unit creation
- **[Site]** everything else, including launch readiness

**Method:** read-only, done by four parallel auditors.
- No files were edited, nothing was deployed, and nothing was written to production.
- Live evidence comes from public GETs of `https://dtw8rs0oq8bpp.cloudfront.net`, HEAD requests on media, the 3D viewer running in the Browser pane, and read-only AWS listings (SES, Route 53, ACM, CSP logs).
- Findings marked *suspected* were read from the code and not reproduced.

**Not covered:** the row-by-row comparison of tracker units against website units. It needs read access to the production tracker database, which the auto-mode safety check blocked. The SQL for it is ready (appendix A), for someone with access to run.

This report follows [system-audit-2026-10-24.md](system-audit-2026-10-24.md). Items that audit fixed are not repeated here.

---

## 1. Security — High

### Findings
- [ ] **[HIGH][Site] The old Render API is still live and connected to a database.**
  - `prime-developers-api.onrender.com/api/health/ready` returns `"database":{"ok":true}`.
  - It runs on the `JWT_ACCESS_SECRET` from public git history, over the old Supabase data, leads included.
  - No site calls it and nobody monitors it.
  - Fix: suspend the Render service, export the data, then pause the Supabase project. **S**
- [ ] **[HIGH][Sync/CMS] Private buyers' names are public on sold units.**
  - About 15–17 sold rows hold individuals' names in `tenant`, for example units 205, 206, 401, 804 and 908.
  - The public card shows them: [UnitDetailCard.jsx:87-95](../apps/web/src/components/UnitDetailCard.jsx), [unitStatus.js:85](../apps/web/src/lib/unitStatus.js).
  - The sync never clears them (`tracker-merge.ts:299-304`).
  - Fix: client decision, then split the field into an internal owner and a public name, and clean up the data. **S**
- [ ] **[HIGH][Sync] Lease rents are in the public JSON.**
  - Rents copied on 16 Sep are exposed, for example $3,684 on unit 202 and $2,554 on 605.
  - The compare table shows `rate` for leased units (`UnitComparePanel.jsx:11`).
  - Fix: client decision; show a rate for available units only, and clear the copied values. **S**
- [ ] **[MEDIUM][Site] Enforcing the CSP would break two things.**
  - **Google Maps embeds:** `frame-src` lacks the Maps host. Two of the three reports in three days are this, from `ContactPage.jsx:178` and `PropertyDetailPage.jsx:773`.
  - **3D textures:** `connect-src` lacks `blob:`. The GLB's textures are fetched from blob URLs, giving 6 violations each time the viewer opens (`website.tf:221`).
  - Traffic is too low for a quiet week to prove much. **S**
- [ ] **[MEDIUM][Site] The privacy policy is wrong.**
  - It says analytics would be announced "before it is switched on" ([PrivacyPage.jsx:93-104](../apps/web/src/pages/PrivacyPage.jsx)).
  - Firebase Analytics and Performance already run in production and set GA cookies.
  - Fix: update the policy and decide on a consent banner. **S**
- [ ] **[MEDIUM][Site] Lead spam protection is thin.**
  - There is a 10/min per-IP throttle and the WAF rate rule, but no honeypot or minimum fill time.
  - `leads.service.ts:236` `findAll()` is unpaginated. **S**
- [ ] **[LOW][Sync] The public API exposes `trackerProjectId`.**

### Stack-specific checks (NestJS / Prisma / CloudFront)
| Check | Result |
|---|---|
| ValidationPipe with whitelist / forbidNonWhitelisted | ✅ on. It is also what breaks the property editor (§2, C1) |
| Rate limiting on public writes and the resizer | ✅ throttles plus the WAF rate rule |
| Admin auth | ✅ HttpOnly, Secure, SameSite=Strict cookie on `/api/auth` |
| CORS allowlist | ✅ but it lists only the CloudFront host; the real domain is missing (§5) |
| Upload validation | ✅ byte-signature checks |
| Optimistic concurrency on whole-record writes | ❌ `properties.service.ts:37-43` PATCHes unconditionally |
| Error tracking (front end and API) | ❌ none |
| IMDSv2 and origin secret | ✅ |

---

## 2. Architecture & Design

### Findings
- [ ] **[CRITICAL][CMS] Every save from the property editor is rejected (C1).** Verified in the code and the live record, not reproduced, because that would write to production.
  - [PropertyEditPage.jsx:190](../apps/web/src/admin/PropertyEditPage.jsx) strips only `id`, `createdAt`, `updatedAt` and `_slugTouched`.
  - The record now carries `trackerProjectId` and `trackerSyncedAt`, and the live API returns both.
  - `property.dto.ts` declares neither, and [main.ts:57-59](../apps/api/src/main.ts) sets `forbidNonWhitelisted: true`, so every save gets a 400.
  - Effect since the 26 Oct API deploy: staff can't edit property fields, buildings, the unit forms inside BuildingBlock, or 3D tagging. The Units page and Covers still work, because they send only `{detail}`.
  - Fix: send an explicit field whitelist, and add a test. **S**
- [ ] **[CRITICAL][Sync] The first push zeroes properties with no buildings or units on the site.**
  - In `tracker-merge.ts:318-394`, totals are summed only over the website's own buildings, and the removal guard can't trip when there are no rows.
  - Tested: Leander goes from 81/48/33 to 0/0/0, which reads "Fully reserved". Rio Ranch and Cap Rate would do the same. Lewisville drops from 77 to 30 units.
  - Fix: refuse the push, or keep the stored totals, when tracker buildings are unmatched; count unmatched units in the totals. **S**
- [ ] **[HIGH][3D] Stale unit bindings knock whole buildings out of the 3D view.**
  - 30 of the 57 links between 3D shapes and units are stale:
    - Building 10: all 9 shapes, since it has 0 units now.
    - Building 6: 19 of 20 shapes, since it now has only `605` and `606+608`.
    - Building 8: the shapes for `812` and `814`.
  - [siteModel.js:90-104](../apps/web/src/lib/siteModel.js) checks the unit binding first and skips the shape when it's stale, without falling back to its building binding.
  - Live effect: Building 10 is missing from the building chips, Building 6 shows a single unit, and 30 shapes render as grey scenery that can't be clicked.
  - [siteModel.js:188-192](../apps/web/src/lib/siteModel.js) also deletes the building binding when a shape is tagged as a unit, so a re-tagged shape goes fully dead on the next relabel.
  - Fix: fall back to `buildingBindings` (**S**), re-tag Building 6 in the admin (**S**), and make relabels maintain the bindings (**M**, next item).
- [ ] **[HIGH][Sync/3D] Relabelling a unit breaks its 3D link and its page URL.**
  - The merge's `mergeRow` (`tracker-merge.ts:288-294`) never re-points bindings.
  - The CMS's [applyUnitChange](../apps/web/src/lib/units.js) (`units.js:340-362`) re-keys only `building.model.bindings`, not `siteModel.unitBindings`, which is what Centro uses.
  - Tested: 605 → 605A kills the shape, and `/units/building-6/605` returns 404.
  - Fix: one shared re-pointing helper used by both; longer term, bind by tracker unit id. **S–M**
- [ ] **[HIGH][Sync] The removal guard covers the whole property, not each building.**
  - The threshold in `tracker-merge.ts:403-404` is more than 3 rows and more than 25% of all rows.
  - So all 8 rows of Building 9, with 27 photos, could be removed without force.
  - The tracker ignores the report on any 200 (`website-sync.service.ts:177-178`), and there is no restore tool for `previous_floor_plans`.
  - Fix: guard each building; require force to remove any row with photos or pins; alert on removals and unmatched buildings. **S–M**
- [ ] **[HIGH][Sync/CMS] Website data is lost whenever a unit's identity shifts.** Rows match by id, then exact label, then split on `+` (`tracker-merge.ts:267-286`).
  - **Splits:** a pair splits when one half's status changes. For example, SOLD 402 plus UNDER_CONTRACT 404 would delete `402+404` and its 5 photos, because the deal ref is only read from SOLD sales and ACTIVE leases (`website-snapshot.ts:69-77`).
  - **Combines:** combining units mints a new tracker id, so the old rows drop.
  - **Moves:** a unit moved between buildings loses its photos.
  - **Prefixes:** "Unit 905" or "0906" don't match 905/906.
  - Fix: send the merged-from ids, match by id across buildings, carry media across overlapping rows, and normalise prefixes. **M**
- [ ] **[HIGH][CMS] Units added in the CMS are deleted by the sync.** Unmatched rows are removed (`tracker-merge.ts:371-373`), and one or two fall under the guard. "Add unit" gives no warning. Fix: a `websiteOnly` flag the merge keeps, or "Create in Prime Tracker" on linked buildings. **M**
- [ ] **[HIGH][CMS] A photo upload wipes edits made meanwhile.**
  - [ImageUploader.jsx:53-54](../apps/web/src/admin/components/ImageUploader.jsx) calls the `onChange` captured when the file was picked.
  - That rebuilds the unit from the old copy (UnitFields `:116`, RepeatableList `:28`, then UnitEditPage `:200`).
  - Anything typed during the upload, or a second upload, is lost; in BuildingBlock the whole buildings array reverts.
  - Fix: functional state updaters. **S–M**
- [ ] **[HIGH][Sync] A dry run is impossible as rolled out, and the doc names the wrong URL.**
  - Once the URL and secret are set, the first cron tick is a real full push (`website-sync.service.ts:156-194`).
  - [tracker-sync-and-aws-plan.md:130](tracker-sync-and-aws-plan.md) points at the Render API, which would write to the wrong database with no error.
  - Fix: start with `?dryRun=true` in `WEBSITE_SYNC_URL` (the query is signed and kept), and correct the doc. **S**
- [ ] **[HIGH][3D] When the viewer fails, it shows "Loading site model…" forever.**
  - On a GLB error, WebGL context loss (iOS after backgrounding) or no WebGL, `viewerFailed` shows the loading skeleton. The error is discarded and there is no retry (`SiteModelSection.jsx:431, 445-450, 512-519`; `ModelViewer.jsx:1629-1632`).
  - Fix: a real fallback (the 2D plan or unit list) with a Retry that calls `useGLTF.clear(url)`, and report the error. **S**
- [ ] **[HIGH][Site] *Suspected:* there is no error boundary above the 3D canvas.**
  - [main.jsx](../apps/web/src/main.jsx) and [App.jsx](../apps/web/src/App.jsx) have none.
  - If the lazy viewer chunk fails to load on a flaky phone, React unmounts the whole app and the page goes blank. **S**
- [ ] **[MEDIUM][Sync] The headline totals disagree with the tracker's header.**
  - The tracker counts taken as SOLD + LEASED + OCCUPIED (`ProjectHealthHeader.tsx:61-64`).
  - The website computes sold as units minus available (`tracker-merge.ts:390-394`), so UNDER_CONTRACT, LEASE_PENDING and UNDER_CONSTRUCTION count as sold.
  - Units in archived buildings count in the header but are not sent.
  - Fix: store a count per status. **S**
- [ ] **[MEDIUM][Sync] Buildings match only by name or trailing number** (`tracker-merge.ts:221-231`). "Building 1 (Retail)" goes unmatched quietly. Fix: an explicit building mapping that fails loudly. **S**
- [ ] **[MEDIUM][CMS] Tracker-owned fields are only partly locked.**
  - Size stays editable, but the sync overwrites it (UnitFields `:51` vs `tracker-merge.ts:297`).
  - Delete stays enabled on synced units (UnitEditPage `:213`).
  - The unit and available counts are typed by hand and then overwritten (BuildingBlock `:64-65`, `tracker-sync.service.ts:74`). **S–M**
- [ ] **[MEDIUM][CMS] There is no server-side conflict check.**
  - Both client checks read first and then write, so two saves can race.
  - "Save anyway" writes a stale record, including old tracker fields, which stays until the hourly push.
  - Fix: send `expectedUpdatedAt`, check it under a row lock, return 409; later, a per-unit endpoint. **M**
- [ ] **[MEDIUM][3D] The site overview labels only Buildings 1, 2, 3, 4 and 7.**
  - Buildings 6, 8, 9 and 10 hold most of the inventory, but all their shapes are unit-tagged, and `labelKinds=['building','road']` skips them (`ModelViewer.jsx:494`).
  - Fix: emit one building label from any entry that carries a building. **S**
- [ ] **[MEDIUM][CMS] Site-model properties get the wrong placement controls.** BuildingBlock checks only `building.model` (`:25, :103`), so Centro shows "Place on map" pins instead of its 3D link status. The unit page shows no placement at all. **S**
- [ ] **[MEDIUM][CMS] Validation gaps.**
  - Empty labels are allowed and duplicate labels only warn (BuildingBlock `:78-83`); a unit with an empty label can't be opened.
  - `formatArea` turns "1,500-2,000" into 15,002,000 sq ft (`units.js:288`).
  - Overlapping labels, such as 201 next to 201+202+203+204, are not flagged. **S**
- [ ] **[MEDIUM][Site] Property cards say "54 buildings · 47 sold".** The count is units, and the "sold" figure includes leased units ([PropertiesPage.jsx:28](../apps/web/src/pages/PropertiesPage.jsx)). **S**
- [ ] **[MEDIUM][Site] The whole site depends on `/api/content`.**
  - A 1.2 s splash is forced every time.
  - On failure, visitors get "Couldn't load the site" with the raw error, although every section has defaults.
  - The old Render "Waking the server" text is still there (`ContentContext.jsx:717-721, 815-822, 829`). **S**
- [ ] **[MEDIUM][Leads] The contact form notifies nobody.** `leads.service.ts:200` only writes the row; leads are visible only at `/admin/leads`. **S** (see §5 for SES)
- [ ] **[LOW]** Smaller issues:
  - An unknown status renders as available (`tracker-merge.ts:209`, `unitStatus.js:69`).
  - LEASED → LEASE_PENDING keeps the outgoing tenant's name.
  - The info page counts rows, not units (`PropertyInfoPage.jsx:599`).
  - `facingRoad` is dead data.
  - The `building-<index>` media folders drift when buildings are reordered.
  - Tap-to-tag numbers units from 101 in every building.

---

## 3. Scalability & Performance

### Findings
- [ ] **[MEDIUM][3D] 62% of the site model is textures that are never shown.**
  - The GLB is 4.66 MB, of which 6 embedded JPEGs are 2.87 MB. They decode to about 35 MB of RGBA and stay cached for the session.
  - The viewer replaces every material (`ModelViewer.jsx:286-317`), so the textures never display.
  - No meshopt or Draco compression, and CloudFront doesn't compress `model/gltf-binary`.
  - Fix: re-export with gltf-transform (strip the textures, apply meshopt), and warn about embedded images at upload in `glbInspect.js`. **S**
- [ ] **[MEDIUM][3D] Every render creates a throwaway WebGL context.**
  - `SiteModelSection.jsx:256` calls `hasWebGL()` on each render: 27 clicks created 75 contexts.
  - Phones cap live contexts, so the viewer's own context could be evicted (suspected), which leads straight into the stuck "Loading…" state.
  - Fix: check once, and release the probe context. **S**
- [ ] **[MEDIUM][3D] Nothing is on screen while the 4.66 MB GLB downloads** (`ModelViewer.jsx:1654`, `fallback={null}`). Fix: a progress overlay. **S**
- [ ] **[MEDIUM][Site] Public API GETs are never cached at the edge.** Still open from 24 Oct.
  - The `/api/*` behaviour uses CachingDisabled, so every visit makes three origin hits, including 70 KB of properties.
  - Those land on the t3.micro shared with the tracker.
  - Fix: a cache policy for public GETs that honours `s-maxage`. **S**
- [ ] **[MEDIUM][Site] The home page transfers about 2.9 MB, 2.5 MB of it in 37 images.**
  - Four `/images/expertise/*.webp` files (928 KB together) bypass the resizer.
  - `/images/*`, the poster and `about-video.mp4` (10.6 MB) are served `max-age=0`. **S**
- [ ] **[LOW][3D]** Wasted work and bytes:
  - Vertex grouping runs for every visitor, though only the admin's tagging uses it (`ModelViewer.jsx:199-221`).
  - Cloning interleaved attributes logs 500+ console warnings.
  - The viewer poster is the 965 KB original image (`ViewerLaunch.jsx:27`).
  - The 404 page loads a 68 KB 3D scene.
- [ ] **[LOW][CMS]** The admin loads raw original images (`ContentContext.jsx:743`), and BuildingBlock renders all 47 unit forms with no collapse or search.

Bundle for reference: first load is about 254 KB gzipped. The 3D chunks load on demand: OrbitControls 143 KB, three.core 374 KB raw, ModelViewer 104 KB raw.

---

## 4. Code Quality
- **Immutable models:** n/a. Units live in one jsonb `detail` record that is written whole, which causes the races, the stale overwrites and the binding drift above. A per-unit write path (§6, phase 2) is the structural fix.
- **Error handling:** missing in three places:
  - the viewer swallows its errors;
  - the brochure email failure returns `emailed:false` while the visitor is told "our team will send it shortly";
  - the tracker ignores sync reports.
- **Dead code:** `facingRoad`, Render's "Waking the server" text, and the demo interiors catalogue still live at `/enterprise/interiors`.
- **Naming:** the `properties.buildings` column holds the unit count, which caused the "54 buildings" bug.
- **Tests:** none for the property editor's payload, the merge's removal guard per building, or binding re-pointing. Each fix above should land with one.

---

## 5. Production Readiness Checklist
- [x] **Secrets kept out of the code** (SSM).
- [ ] **Logging and alerting, partial:**
  - API logs reach CloudWatch.
  - There is no front-end error tracking and no website-API error alarm.
  - CloudFront logs are off.
  - UptimeRobot was never applied.
  - The only external check emails one address.
- [x] **Rate limiting** (throttles plus WAF). The leads honeypot is missing.
- [ ] **Background jobs, partial:** the sync cron retries every 5 minutes, but its reports are ignored and removed rows have no restore tool.
- [ ] **Migrations, partial:** Prisma migrations only go forward. The sync keeps `previous_floor_plans` as a rollback copy, but nothing restores from it.
- [ ] **Lead delivery:**
  - Nothing emails staff about new leads.
  - SES is in sandbox with no verified identity, so every brochure email is rejected.
  - Admin users on AWS are unconfirmed (`04-copy-admins.sh`).
- [ ] **Domain cutover**, a launch blocker. Everything is coupled to the CloudFront hostname:
  - 318 absolute media URLs are stored in the data;
  - `SITE` is hardcoded in `scripts/deploy-web-aws.sh:38` and `scripts/aws/lib.sh:20`;
  - CORS lists only the CloudFront host;
  - the resizer only resizes media on the build's own origin.
- [ ] **DNS:**
  - `enable_dns=true` would create an empty zone in the production account, with no MX or TXT records, and wait on an ACM validation in a zone that isn't authoritative.
  - The live zone holds Google Workspace MX records, so company email would break.
- [ ] **Old URLs:** none redirect. `/aboutus` gives a soft 404, `/index.php/...` an S3 403. Four old projects (Spur Plaza, Reagan Crossing I and II, Rio Ranch Commercial Lots) are missing from the new site.
- [ ] **SEO:**
  - Every route has the same title and description.
  - There are no OG, Twitter or canonical tags.
  - `robots.txt` and `sitemap.xml` return 403.
  - Unknown routes return 200 with no `noindex`.
- [ ] **Placeholder content is visible:**
  - The footer and JSON-LD show `hello@primedevelopers.com`, a domain someone else owns, and a fake phone number and address.
  - The social links are `#`.
  - The interiors page is a "Demo catalog".
  - The testimonials look invented (suspected).
- [x] **Backups:** RDS has 30-day point-in-time recovery and Multi-AZ, and the media bucket is versioned. Restoring `prime_website` means restoring the whole shared instance; add a nightly `pg_dump`.

---

## 6. Priority Action Plan

🔴 **P1, fix now (days):**
- C1, the property editor save.
- The photo-upload race.
- The 3D binding fallback and site-level labels.
- Honest viewer failure: an error boundary, fallback with Retry, and a single WebGL check.
- The footer contact details and socials.
- Google Maps in the CSP.
- An email to staff on new leads, and starting SES domain verification plus production access.
- Suspend the Render API.

🟡 **P2, this sprint:**
- Sync safety fixes, then turn the sync on as a dry run for Centro.
- The CMS unit editor redesign.
- Filling in unit data, and units for the other projects.
- Re-exporting the GLB.
- Privacy cleanup: buyer names and rents.
- The domain-cutover groundwork.

🟢 **P3, debt to track:**
- Prerendering for SEO.
- Monitoring and error tracking.
- Edge caching.
- Accessibility: focus traps, light-theme contrast.
- A nightly dump.
- 3D CPU trims.

### Fix plan by phase

Rough effort is in engineer-days. Phases 1 and 4 can run alongside phase 0; phase 2 needs phase 1's ownership model.

**Phase 0 — stop the bleeding (about 2 days)**
1. **C1:** send an explicit property payload whitelist, plus an API test that the editor's payload passes the DTO.
2. **Photo uploads:** functional updaters, so an upload never reverts concurrent edits.
3. **3D bindings:** `reconcileSite` falls back to `buildingBindings` when a unit binding is stale, and every building gets a site-level label. This brings Buildings 6 and 10 back. Then re-tag Building 6's units in the admin.
4. **Viewer failure:** an app-level error boundary around the lazy viewer, a real fallback (2D plan or unit list) with Retry (`useGLTF.clear`), error reporting, and a memoised `hasWebGL()` that releases its probe.
5. **CSP:** add the Google Maps host to `frame-src` and `blob:` to `connect-src`.
6. **Contact details:** correct the footer and JSON-LD to sales@theprimedeveloper.com and +1 512-761-8025, the real socials, and the real address (to confirm).
7. **Lead delivery:** email sales@ on every lead, with the failure logged. Start SES DKIM verification and the production-access request now, because they take days.
8. **Render:** suspend the Render service. Pausing Supabase comes after a data export.

**Phase 1 — make the tracker sync safe, then turn it on for Centro (3–4 days)**
1. **Refuse partial pushes:** reject a push, or keep the stored totals, when tracker buildings are unmatched or the website has no floor plans for the property.
2. **Removal guard per building:** force needed for any row with photos or pins. The tracker logs and alerts on every non-empty report.
3. **Re-point bindings:** one shared helper re-points `siteModel.unitBindings` and `model.bindings` on relabel, used by both the merge and the CMS.
4. **Carry media across identity changes:** splits, combines, moves and prefixes, using merged-from ids and number overlap.
5. **Counts per status:** store them, so the headline can match the tracker's header once the client decides how to count UNDER_CONTRACT and LEASE_PENDING.
6. **Explicit building mapping:** tracker building id → website building index, failing loudly when unmapped.
7. **Fix the doc:** the URL is CloudFront, not Render.
8. **Go-live:**
   - set `WEBSITE_SYNC_SECRET` = `/prime-tracker/website/TRACKER_SYNC_SECRET`;
   - set `WEBSITE_SYNC_URL` = `https://dtw8rs0oq8bpp.cloudfront.net/api/integrations/tracker/snapshot?dryRun=true`;
   - set `websiteSlug = 'centro-plaza'` on project `cmtiyjnbg01bdh360e0mfslii`;
   - run the appendix A SQL and diff;
   - read the dry-run report;
   - only then drop `?dryRun=true`.

**Phase 2 — the CMS shows everything about a unit (5–6 days)**
1. **Split ownership in each unit row.**
   - A `tracker` sub-object written only by the sync: ids, unit number, status, sqft, unit type, asking rent/price, occupant, available since, synced-at.
   - Website fields at the top level: images as `{url, alt}`, description, floor, frontage, logo, public name, an optional rate override, and placement.
   - The public site shows the website value, falling back to the tracker's where allowed.
2. **Snapshot v2 from the tracker** adds unit type, asking rent/price, the floor/mezzanine split, available since, and building sq ft and stories. Never buyers.
3. **A unit page with three panels.**
   - "From Prime Tracker": read-only, with last-synced time and a link to the tracker unit.
   - "Website content": multi-file upload, alt text, drag to reorder.
   - "Placement": 3D link status from `reconcileSite`, or the 2D pin.
4. **A Units list with a completeness score** and filters: missing photos, description, size, rate, placement.
5. **Per-unit save:** `PATCH /admin/properties/:id/units/:key` updates one unit inside a row lock, with a 409 on conflict. Unit edits never resend the whole property.
6. **Creating units.**
   - On tracker-linked buildings, "Add unit" becomes "Create in Prime Tracker", plus "Sync now".
   - Website-only units need an explicit `websiteOnly` flag that the merge keeps.
   - Locked tracker fields get a "Managed by Prime Tracker" hint, and Delete is disabled on synced units.
7. **A sync page in the admin:** the latest reports, a dry-run preview, and restoring removed rows from `previous_floor_plans`.
8. **Validation:** no empty or duplicate labels, overlap warnings, and range-safe area parsing. Plus a weekly sweep of unreferenced S3 objects older than 30 days.

**Phase 3 — fill in the data and create the missing units (about 2 engineer-days, plus client content time)**
1. **Centro gaps,** from the live data:
   - floor and frontage are empty on all 47 rows;
   - 8 rows have no size;
   - 7 of 7 available units have no rate;
   - 12 have no description;
   - 18 have no photos;
   - 20 have no placement;
   - Building 7's six units have no details at all.
2. **Lewisville Phase I and II:**
   - Phase II is a copy of Phase I;
   - each has 2 building summaries but 0 unit rows, and the building sums (31/13) don't match the headline (77/14);
   - the units go into the tracker per building, and the sync creates them after the client confirms the I/II mapping (`websiteSlug` is unique, so one project per listing).
3. **Leander (81), Rio Ranch (55), Cap Rate (12):** no buildings or units on the site. Create the buildings on the website first (so phase 1's guard passes), then slug the tracker projects one at a time.
4. **Old projects:** Spur Plaza, Reagan Crossing I and II, and Rio Ranch Commercial Lots, if the client wants them back.
5. **Privacy cleanup:** clear the buyer names and lease rents once the client decides.

**Phase 4 — 3D performance and polish (about 1.5 days)**
1. **Re-export the site GLB** with gltf-transform: strip the 6 unused textures, apply meshopt. It goes from 4.66 MB to about 1.5 MB (estimate), with no blob CSP reports and about 35 MB less memory. `glbInspect.js` warns about embedded images at upload.
2. **A loading overlay** with progress.
3. **Skip vertex grouping** unless tagging, and copy attributes without `clone()`.
4. **Smaller assets:** a resized poster image, and drop the 3D scene from the 404 page.
5. **Phones and motion:** release the scroll on phones when the viewer isn't focused, and respect reduced motion in camera damping.

**Phase 5 — launch readiness: the real domain (6–8 days)**
1. **Store media root-relative** (`/media/...`, a one-off migration of 318 URLs). `SITE` becomes a deploy parameter. Add the domain to CORS and the CSP.
2. **DNS plan:**
   - copy MX, TXT and DKIM records before any nameserver switch, or validate ACM in today's authoritative zone;
   - split the website aliases out of `enable_dns`;
   - 301 www → apex.
3. **Old-URL redirects** in the `website-spa` function:
   - `/index.php/homecontroller/projectdetails/{1,2,3,7,9,13}` → the matching property;
   - 4, 5, 6 and 8 → `/properties`;
   - `/aboutus` → `/about`, `/allprojects` → `/properties`, `/contactus` → `/contact`.
4. **SEO:** prerender the public routes at build time with per-route title, description, OG and canonical tags; add `robots.txt` and a generated `sitemap.xml`; add `noindex` on not-found pages.
5. **Edge caching** for public API GETs, and long caching for `/images/*` and the video. Drop the forced splash, and render defaults when `/api/content` fails.
6. **Monitoring:** apply UptimeRobot, add CloudFront 4xx/5xx and website-API error alarms, error tracking (e.g. Sentry), and a nightly `pg_dump` of `prime_website` to S3.
7. **Content and policy:**
   - replace the interiors demo catalogue or hide the route;
   - confirm the testimonials;
   - update the privacy policy and decide on a consent banner;
   - focus traps in the mobile menu and the dialogs;
   - fix light-theme contrast (ember text on white is 2.0:1).

---

## Decisions needed from the client

1. **Buyers' names on sold units:** show a business name, nothing, or keep them? Also remove the lease rents now in public data.
2. **UNDER_CONTRACT and LEASE_PENDING:** how should they show (today: "sold" / "leased"), and should the headline count them as taken?
3. **Lewisville:** what should Phase I and Phase II each show? Today II is a copy of I.
4. **Which projects to publish** from the tracker, and whether the four old projects come back.
5. **Empty buildings:** Building 3 and Building 10 on Centro have no units. Show them as empty, or hide them?
6. **Building 6 and 8 rows:** which row is odd and which is even? The 3D tagging assumed the row facing the entrance is odd.
7. **Testimonials and the interiors catalogue:** real content, or remove?
8. **Analytics consent:** a banner, or switch Firebase Analytics off?

---

## Skills for this work

**Already installed, and worth using per phase:**

| Phase | Skills |
|---|---|
| 0, 2 | `vercel-react-best-practices`, `frontend-ui-engineering` |
| 1, 2 | `nestjs-best-practices`, `prisma-client-api`, `database-migration`, `api-and-interface-design`, `test-driven-development` |
| 4, 5 | `performance-optimization`, `browser-testing-with-devtools` |
| 5 | `seo-audit`, `security-and-hardening`, `observability-and-instrumentation`, `aws-deployment` and `rds-oss` (project skills) |
| 2 (admin UX) | `anthropic-skills:web-design-guidelines`, `design-audit` |

**Worth installing from the open registry (checked):**
- **CloudAI-X/threejs-skills** (3.8K stars, 13–20K installs per skill, updated 19 Oct 2026). For phases 0 and 4, especially loaders, GLB optimisation and interaction:
  - `npx skills add CloudAI-X/threejs-skills@threejs-loaders`
  - `npx skills add CloudAI-X/threejs-skills@threejs-fundamentals`
  - `npx skills add CloudAI-X/threejs-skills@threejs-interaction`
- **Optional: cloudflare/skills@web-perf** (111K installs, official). General web-performance auditing for phase 5; not CloudFront-specific.

**Not recommended:**
- The registry's CMS skills target other platforms (Wix, Strapi, Bagisto) and have under 300 installs.
- `squirrelscan/skills@audit-website` needs its own CLI and has a 104-star source.
- `freshtechbro/claudedesignskills@react-three-fiber` has not been updated since Nov 2025.

---

## Appendix A — tracker ↔ website diff SQL (read-only, not yet run)

This is checked against the tracker's Prisma schema. It lists, for every project with a `websiteSlug`, each unit the way the sync would send it:
- the website row label;
- the tracker and website status;
- sqft, unit type, asking rent and price;
- the occupant the sync would send;
- deal refs.

A second query gives the header totals to reconcile against.

- **The SQL:** [tracker-website-diff.sql](tracker-website-diff.sql). It runs inside `BEGIN TRANSACTION READ ONLY … ROLLBACK`, and its third query lists every project with its slug, building count and unit count.
- **How to run it:** on the tracker host, as the `prime_tracker_app` login.
- **Prerequisite:** today no project has a `websiteSlug`. Set Centro's first, or change the `WHERE` clause to `p.id = 'cmtiyjnbg01bdh360e0mfslii'`.

## Appendix B — evidence files (scratchpad)
- **CMS completeness pull and script:** `/private/tmp/claude-501/-Users-kalyan-Client-project-PrimeDevelopers-web/2fe8c33d-1e87-456e-ab0d-5ea34e20fded/scratchpad/`
- **Merge test harness**, run against the live Centro data: `/private/tmp/claude-501/-Users-kalyan-Client-project-PrimeDevelopers-web/2fe8c33d-1e87-456e-ab0d-5ea34e20fded/scratchpad/scripts/harness.mts`
- **Site audit JSON and URL checks:** `/private/tmp/claude-501/-Users-kalyan-Client-project-PrimeDevelopers-web/2fe8c33d-1e87-456e-ab0d-5ea34e20fded/scratchpad/audit`
- **Local build output:** `/private/tmp/claude-501/-Users-kalyan-Client-project-PrimeDevelopers-web/2fe8c33d-1e87-456e-ab0d-5ea34e20fded/scratchpad/dist`
