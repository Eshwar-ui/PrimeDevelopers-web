# Tasks: fixes for the 15 Nov 2026 audit

Plan, decisions and risks: [plan.md](plan.md). One finding per task, one commit per task, on
`fix/audit-2026-11-15`. Every task must leave the full suites green:

- API: `pnpm --filter @prime-developers/api test` and `pnpm --filter @prime-developers/api build`
- Web: `pnpm --filter @prime-developers/web test`, `pnpm --filter @prime-developers/web lint` (0 errors) and `pnpm --filter @prime-developers/web build`

Baseline on 15 Nov: API 123/123, web 120/120, both builds pass, web lint has warnings only.

---

## Phase 0: Baseline

## Task 0: Record the green baseline

**Description:** Before any change, confirm the suites, builds and live smoke check are green on
the branch tip, so that any later failure is known to be caused by this work.

**Acceptance criteria:**
- [x] `fix/audit-2026-11-15` is cut from `release/2026-11-13`
- [x] Test counts, the build result and `pnpm audit --prod` totals are written in the PR description

**Verification:**
- [x] Both suites, the web lint and both builds pass
- [x] `node scripts/smoke.mjs` passes against the live site

**Dependencies:** None  **Files:** none  **Scope:** XS

---

## Phase 1: Live bugs and API security

## Task 1: Brochure emails go out even when the flyer URL is invalid

**Description:** A flyer URL that isn't absolute `https:`, such as the placeholder `#` on Centro
Plaza and POW Lewisville today, currently throws inside `sendBrochureEmail()`, and the visitor gets
nothing. Treat any non-`https:` or unparseable URL as "no brochure", so the thank-you email still
goes out, without an attachment, saying the team will follow up.

**Acceptance criteria:**
- [x] `flyerUrlFor()` returns `null` for a value that is not a valid absolute `https:` URL (`#`, relative, `http:`, `javascript:`)
- [x] A brochure request for such a property sends the thank-you email with no attachment, and the
      response is `emailed: true, hasBrochure: false`
- [x] Must not change: properties with a valid HTTPS flyer behave exactly as before

**Verification:**
- [x] New tests in `apps/api/test/hardening.test.ts` fail before the fix and pass after
- [x] Full API suite and build pass

**Dependencies:** Task 0
**Files:** `apps/api/src/modules/leads/leads.service.ts`, `apps/api/test/hardening.test.ts`
**Scope:** S

## Task 2: Brochure fetch cannot reach private addresses or attach non-PDFs

**Description:** Replace the bare `fetch(flyerUrl)` with a small `fetchPublicPdf()` helper. It
uses `https.request` with a custom `lookup` that refuses loopback, private (RFC 1918), link-local
(including `169.254.169.254`), CGNAT, ULA and unspecified addresses at connect time, which closes
the DNS-rebinding window. It follows at most 3 redirects, each re-checked. It keeps the existing
10-second timeout and 8 MB cap. It attaches the file only when the content type is
`application/pdf` and the body starts with `%PDF-`. Any refusal falls back to Task 1's
"no attachment" email.

**Acceptance criteria:**
- [x] URLs that resolve to a blocked range, including after a redirect, are refused before any bytes are sent
- [x] A 200 `text/html` response (today's Google, LoopNet and bit.ly links) is not attached
- [x] The 10-second timeout and the 8 MB `readCapped` limit are kept; the existing `readCapped` tests still pass

**Verification:**
- [x] Unit tests for the address classifier (IPv4, IPv6, IPv4-mapped IPv6) and for redirect,
      non-PDF and oversize cases, using a local HTTPS stub
- [x] Full API suite and build pass

**Dependencies:** Task 1
**Files:** `apps/api/src/modules/leads/safe-fetch.ts` (new), `leads.service.ts`, `apps/api/test/safe-fetch.test.ts` (new)
**Scope:** M

## Task 3: Brochure endpoint has a per-IP daily cap and a global daily ceiling

**Description:** Add a named `daily` throttler (ttl 24 h) whose default limit (100,000) is far
above any real traffic, so no other route changes. Override it to 20 on `POST /leads/brochure`.
Add a global ceiling, `BROCHURE_DAILY_CAP` (default 200), counted from `website_leads` like the
existing per-address limit. Over either limit, the lead is saved, the email is withheld and staff
are notified with the reason. This is the existing path, reused.

**Acceptance criteria:**
- [ ] The 21st brochure request from one IP within 24 hours gets 429; other routes are unaffected
- [ ] Above the global ceiling, the lead row is still written and staff are still notified, with the reason
- [ ] Must not change: the per-address limit of 3 per day and the 10-per-minute throttle

**Verification:**
- [ ] Tests for the ceiling logic. One test sends 50 requests to `GET /properties` through the
      guard and asserts it is not throttled by `daily`.
- [ ] Full API suite and build pass

**Dependencies:** Task 2 (same file)
**Files:** `apps/api/src/app.module.ts`, `leads.controller.ts`, `leads.service.ts`, `apps/api/.env.example`, a test file
**Scope:** M

## Task 4: Admin login locks an account after repeated failures

**Description:** Add an in-memory `LoginAttempts` keyed by normalised email: after 5 failures
within 15 minutes, the account is locked for 15 minutes. While it is locked, a login still runs
the dummy bcrypt compare and returns the same 401 message, so timing and wording reveal nothing.
A success clears the counter, and every lock writes one log line. A comment at the map records the
single-process assumption (pm2 fork, `02-deploy-api.sh:258`).

**Acceptance criteria:**
- [ ] The 6th attempt within 15 minutes is refused even with the right password; it works again after 15 minutes
- [ ] Unknown and known emails get the identical response
- [ ] Must not change: the per-IP 5-per-minute throttle, refresh rotation and logout

**Verification:**
- [ ] Unit tests with an injected clock; full API suite and build pass

**Dependencies:** Task 0
**Files:** `apps/api/src/modules/auth/login-attempts.ts` (new), `auth.service.ts`, `auth.module.ts`, `apps/api/test/auth-lockout.test.ts` (new)
**Scope:** M

## Task 5: API runtime dependencies upgraded past the critical and high advisories

**Description:** Upgrade `multer` (≥ 2.1.0) and `sharp` (≥ 0.35.0, an explicit bump from
`^0.34.5`). Resolve the transitive packages, `express`→`proxy-addr` ≥ 2.0.8, `body-parser`
≥ 1.20.9, `lodash` ≥ 4.18.0 and `js-yaml` ≥ 4.3.0, with `pnpm update` first and
`pnpm.overrides` only where the range won't move. No NestJS major version bump.

**Acceptance criteria:**
- [ ] `pnpm audit --prod` shows no critical or high advisories with an `apps__api` path
- [ ] Image upload, `/api/img` resize (WebP output, EXIF rotate) and `.glb` upload behave as before
- [ ] The production install resolves a `sharp` binary for the EC2 host (linux-arm64)

**Verification:**
- [ ] `apps/api/test/media.test.ts` and the full suite pass; the build passes
- [ ] After the API deploy: `/api/health/ready` returns 200, an `/api/img/...?width=600&quality=75`
      request returns `image/webp`, and an admin upload of one JPEG works. If any of these fails,
      roll back with `scripts/aws/rollback-api.sh`.

**Dependencies:** Task 0
**Files:** `apps/api/package.json`, `package.json` (overrides, if needed), `pnpm-lock.yaml`
**Scope:** S (high risk, so done last in Phase 1)

### Checkpoint A: after Tasks 1–5
- [ ] Suites and builds green; no critical or high advisories under `apps__api`
- [ ] API deployed (`scripts/aws/02-deploy-api.sh`); `node scripts/smoke.mjs` passes
- [ ] A centro-plaza brochure request from a test address you own delivers the thank-you email
- [ ] PR opened; review with the user before Phase 2

---

## Phase 2: Infrastructure and deploy

## Task 6: Confirm the old Render API is gone and retire `render.yaml`

**Description:** `prime-developers-api.onrender.com` did not answer on 15 Nov. In the Render
dashboard (the user does this), confirm the service is deleted, or suspend and delete it. Then
delete `render.yaml` and replace the code and doc references to `onrender.com`, Render and Firebase
Hosting with the AWS setup. The deploy script's guard against `onrender.com` in the bundle stays.

**Acceptance criteria:**
- [ ] The Render service no longer exists (dashboard screenshot or user confirmation)
- [ ] `git grep onrender.com` only returns the deploy-script guard and historical audit docs

**Verification:** web build passes; `git grep -n "render.yaml\|Firebase Hosting"` shows only historical docs
**Dependencies:** None (needs the user)  **Files:** `render.yaml` (delete), `README.md`, `docs/render-deploy.md` (archive note)  **Scope:** S

## Task 7: Read a week of CSP reports and clear every legitimate violation

**Description:** Read only: export the `[CSP]` lines from the website API's CloudWatch log group
for the last 7 days and group them by directive and blocked URI. Then sort them: legitimate (add
the source to `website_csp`), extension or noise (ignore, with a written reason), or a real bug
(fix it in this repo). Make sure the period includes admin use: editing a property, uploading,
opening the 3D tagger.

**Acceptance criteria:**
- [ ] A table of every distinct violation and the decision taken on it, written to `docs/csp-rollout.md`
- [ ] Every legitimate source is added in the tracker repo's `website.tf`, and the report-only header is applied

**Verification:** `terraform plan` shows only the header value changing; after apply, 48 hours of logs show no new legitimate violations
**Dependencies:** None  **Files:** `docs/csp-rollout.md` (new); tracker repo `infra/terraform/website.tf`  **Scope:** S

## Task 8: Web deploy publishes `robots.txt` and `sitemap.xml`

**Description:** In `scripts/deploy-web-aws.sh`, after `vite build`, run `node scripts/seo-assets.mjs`
with the arguments it documents for this host (the CloudFront host gets `Disallow: /` and the
real domain gets the open file). Correct `seo-assets.mjs`'s header, which says the deploy already
does this.

**Acceptance criteria:**
- [ ] `curl $SITE/robots.txt` and `curl $SITE/sitemap.xml` return 200 with the expected content
- [ ] On the CloudFront host, `robots.txt` disallows crawling
- [ ] Must not change: all other files and cache headers

**Verification:** run the script locally up to the sync (dry run with `aws s3 sync --dryrun`), then deploy and curl both files
**Dependencies:** None  **Files:** `scripts/deploy-web-aws.sh`, `scripts/seo-assets.mjs` (comment)  **Scope:** XS

## Task 9: `website_spa` consults a KeyValueStore of prerendered routes (tracker repo)

**Description:** Add an `aws_cloudfront_key_value_store` and associate it with `website_spa`. The
function first normalises the path (no trailing slash, lowercased host-independent path). If the
path is a key in the store, it rewrites to `<path>/index.html`; otherwise it rewrites to
`/index.html` exactly as today. Files with extensions pass through untouched, as today. It ships
with the store empty, so behaviour is identical.

**Acceptance criteria:**
- [ ] With the store empty, `/`, `/about`, `/properties/centro-plaza`, `/nope` and `/robots.txt` respond exactly as before (status and body)
- [ ] With one test key added by hand, only that path serves its own file; removing the key restores the default

**Verification:** `terraform plan` reviewed; the function tested with `aws cloudfront test-function` for all five paths, with and without a key; the curl checks above after apply
**Dependencies:** None  **Files:** tracker repo `infra/terraform/website.tf`  **Scope:** S

## Task 10: Web deploy prerenders each route's head and registers it in the store

**Description:** In `deploy-web-aws.sh`, run `node scripts/prerender.mjs --site "$SITE" --api "$SITE" --out "$DIST"` after the build. Upload as today, then sync the store: put each
prerendered path and delete keys for paths no longer produced, using the store's ETag. Write
`docs/seo-setup.md`, which `prerender.mjs` already points to, describing the three-step design.

**Acceptance criteria:**
- [ ] A share-preview fetch of `/properties/centro-plaza` (curl with a Facebook or LinkedIn user agent) shows that property's `<title>`, description, `og:image` and canonical
- [ ] Every prerendered HTML file has the same two inline-script hashes as the shell (checked in the script; the deploy fails otherwise)
- [ ] Must not change: an unknown route and a property published after the deploy still load the app; the CloudFront host still says `noindex`

**Verification:** the deploy output lists the routes; curl five paths before and after; open the home and a property page in a browser
**Dependencies:** Task 9 applied  **Files:** `scripts/deploy-web-aws.sh`, `docs/seo-setup.md` (new)  **Scope:** M

## Task 11: Web deploy fails, instead of warning, when a CSP hash is missing

**Description:** Move the inline-script hash check to after prerendering and make a missing hash
exit 1 before any upload. Keep the message that says where to add the hash.

**Acceptance criteria:**
- [ ] A build whose inline-script hash is not in the live policy stops before `aws s3 sync`
- [ ] The current build, whose hashes match, deploys normally

**Verification:** change one byte of an inline script in a scratch build and confirm the script exits 1 and nothing is uploaded; revert it
**Dependencies:** Task 10  **Files:** `scripts/deploy-web-aws.sh`  **Scope:** XS

## Task 12: Enforce the CSP (tracker repo)

**Description:** Rename the header from `Content-Security-Policy-Report-Only` to
`Content-Security-Policy` and keep `report-uri`. Update the comment above it.

**Acceptance criteria:**
- [ ] The live response has `content-security-policy` and no `-report-only` header
- [ ] Home, a property with a 3D model, the 404 page's 3D scene, a page with a YouTube embed, admin login, property edit and upload all work

**Verification:** a browser pass over that list with the console open; 24 hours of `[CSP]` logs reviewed. Rollback is renaming the header back and applying, which takes minutes.
**Dependencies:** Tasks 7 and 11  **Files:** tracker repo `infra/terraform/website.tf`  **Scope:** XS (high risk)

### Checkpoint B: after Tasks 6–12
- [ ] Share previews show per-property heads; unknown routes still load the app
- [ ] The CSP is enforced and the site is clean; review with the user before Phase 3

---

## Phase 3: Hygiene

## Task 13: Privacy policy matches the analytics the site runs

**Description:** **Blocked on Open Question 1.** Option A: the client provides wording and
`PrivacyPage.jsx`'s "Cookies and analytics" clause names Google Analytics and Firebase Performance.
Option B: remove `apps/web/src/lib/firebase.js`, its import, its env variables and the analytics
hosts in `website_csp`.

**Acceptance criteria:** the policy and the shipped code agree; with option B, no requests to `*.google-analytics.com` in the network log
**Verification:** web suite and build pass; a browser network check
**Dependencies:** a client decision (option B also touches the CSP, so it goes after Task 12)  **Files:** `apps/web/src/pages/PrivacyPage.jsx` **or** `apps/web/src/lib/firebase.js` and its caller  **Scope:** S

## Task 14: Repo root cleanup

**Description:** Move the four tracked `reagan-crossing-*-backup-*.json` files and the two `.docx`
files to the location chosen in Open Question 4, `git rm --cached` them, and add
`/*-backup-*.json` and `/*.docx` to `.gitignore`. Delete the local
`apps/web/public/test-model.glb` (ignored, used by nothing). Tick and archive the 28 Oct
`tasks/plan.md` and `todo.md`. Drop the stashes only if the user says so (Open Question 5).

**Acceptance criteria:**
- [ ] `git ls-files` at the root lists no backups or `.docx`; copies exist at the agreed location
- [ ] Must not change: the brand guidelines folder, which `CLAUDE.md` cites

**Verification:** `git status` is clean after the commit; the web build passes
**Dependencies:** Open Questions 4 and 5  **Files:** `.gitignore`, the moved files, `tasks/`  **Scope:** S

## Task 15: Placeholder brochure links removed from the CMS

**Description:** Through the admin, the user replaces `#` with the real flyer PDF, or removes the
link, on Centro Plaza and POW Lewisville. A dry-run script can list every `resourceLinks` entry
that is not an absolute `https:` URL across all properties.

**Acceptance criteria:** no property has a non-`https:` resource link; a brochure request for each property returns `hasBrochure` matching reality
**Verification:** a public `GET /api/properties` scan (the same one used in the audit)
**Dependencies:** Task 1 (so nothing breaks in the meantime)  **Files:** none, or a read-only scan script  **Scope:** XS

## Task 16: Web toolchain dependencies upgraded

**Description:** Update `@tailwindcss/vite`, `vite` (≥ 8.1.6) and `firebase`, to clear `nanoid`,
`source-map-js`, `@grpc/grpc-js` and `re2js`. These are build-time or browser-unused paths, so the
risk is low, but the audit should come back clean.

**Acceptance criteria:** `pnpm audit --prod` shows no critical or high advisories with an `apps__web` path
**Verification:** web suite, lint and build pass; `pnpm dev` loads home, a property with its 3D view, and the admin
**Dependencies:** None (do it after Task 13 if option B removes `firebase`)  **Files:** `apps/web/package.json`, `pnpm-lock.yaml`  **Scope:** S

## Task 17: The API has a linter

**Description:** Add `oxlint` to `apps/api`, the same tool the web app uses, with a `lint` script.
Fix only errors and leave warnings, so the diff stays small.

**Acceptance criteria:** `pnpm --filter @prime-developers/api lint` exits 0; `pnpm lint` at the root covers both apps
**Verification:** the lint passes; the API suite and build pass (no behaviour change)
**Dependencies:** None  **Files:** `apps/api/package.json`, `pnpm-lock.yaml`, files with lint errors only  **Scope:** S

## Task 18: The 579 kB model chunk stays off pages without a 3D viewer

**Description:** Find out why `modelUrl-*.js` is 579 kB (likely loader code pulled in by a static
import) and make sure it loads only on routes that render a model. Measure first: if the home page
already doesn't fetch it, raise `chunkSizeWarningLimit` with a comment instead of refactoring.

**Acceptance criteria:** the home page's network log has no `modelUrl` or `three` chunk; a property page's 3D view still renders
**Verification:** a before-and-after `vite build` size table; a browser check (WebGL frame via `gl.readPixels`, see notes)
**Dependencies:** None  **Files:** `apps/web/src/lib/modelUrl.js` and its importers, or `vite.config.js`  **Scope:** S–M

## Task 19: The 10 MB about video does not load before it's needed

**Description:** Check how `/about-video.mp4` (the default `videoUrl` in `ContentContext.jsx:71`)
is rendered. Make sure it has a poster and `preload="none"` (or `metadata`) and starts only in
view. If it autoplays above the fold, re-encode it (target ≤ 3 MB) and serve it from `/media`.

**Acceptance criteria:** the home and about pages don't download the full video before it plays; the video still plays
**Verification:** network log transfer size before and after; a playback check
**Dependencies:** None  **Files:** the about video component, or `ContentContext.jsx`  **Scope:** XS–S

### Checkpoint C: complete
- [ ] Every task above checked; both suites, lint and builds green; `pnpm audit --prod` has no critical or high advisories
- [ ] `docs/seo-setup.md` and `docs/csp-rollout.md` written; stale Firebase and Render references gone
