# Implementation Plan: fixes for the 15 Nov 2026 audit

## Overview

The 15 Nov audit (API code, live endpoints, dependencies, web build) found nothing on fire. It
did find a short list of real defects, each to be fixed as its own small change. This plan turns
every finding into one targeted task with a regression guard, ordered so the riskiest fixes land
first and every task leaves the site deployable.

Planning re-checked each finding against the code and the live site, and that changed some of
them:

- **New, live bug (not in the report):** on Centro Plaza and POW Lewisville the brochure flyer
  URL is the placeholder `#`. `fetch('#')` throws inside `sendBrochureEmail()`, so a visitor who
  asks for either brochure gets **no email at all**, not even the thank-you. Task 1.
- **New, live gap (not in the report):** per-route SEO (commit `b4b32c7`: `prerender.mjs`,
  `seo-assets.mjs`) was built for Firebase Hosting and never wired into the AWS deploy. Live, every
  page serves the same `<title>`, with no description or canonical, and `robots.txt` and
  `sitemap.xml` return 403. The doc it points to, `docs/seo-setup.md`, does not exist. Tasks 8–10.
- **Brochure SSRF:** an allowlist of our own media host would break nothing today, because no
  property has a working brochure. Every brochure URL in the CMS is a web page (Google, LoopNet,
  bit.ly) or `#`, so none is a PDF. The fix is therefore a strict one: HTTPS only, public IPs only,
  checked at connect time, redirects re-checked, and only a real PDF gets attached. Task 2.
- **Old Render API:** `https://prime-developers-api.onrender.com` did not answer on 15 Nov (no HTTP
  response). It is probably suspended. That needs confirming in the dashboard; it cannot be proven
  from here. Task 6.
- **The CSP lives in the other repo:** `prime-tracker-main/infra/terraform/website.tf`. Enforcing
  it without first making the web deploy *fail* on a missing inline-script hash would let a future
  deploy blank the theme script on every page. Task 11 has to come before Task 12.

## Ground rules (how every task is done)

1. **One finding per commit.** Never fold in a drive-by change; anything noticed on the way gets a
   line under Open Questions, not a code change.
2. **Test first where there is logic.** Write a failing test in `apps/api/test/*.test.ts` or
   `apps/web/test/*.test.js` that reproduces the finding, then make it pass. The existing suites are
   the regression net: API 123/123 and web 120/120 on 15 Nov.
3. **No schema changes.** The schema is owned by `supabase/migrations/*.sql` and applied to RDS by
   hand through SSM. Nothing in this plan needs a migration, and any design that would (for
   example, lockout columns) is rejected in favour of one that doesn't.
4. **Behaviour for real visitors stays the same** unless the task says otherwise. Each task names
   what must *not* change.
5. **Deploy order:** API before web (`scripts/aws/02-deploy-api.sh`, then
   `scripts/deploy-web-aws.sh`). The tracker repo's Terraform is applied separately, from a clean
   branch off its `main`. Its checkout is on `feat/interior-po-invoice-uploads` with a modified
   `.claude/launch.json`, so do not apply from there.
6. **Branch:** `fix/audit-2026-11-15`, cut from `release/2026-11-13` (which is ahead of `main`),
   with one commit per task. Phase 1 ends in one PR.

## Architecture decisions

- **Login lockout is in-memory, keyed by normalised email.** The API runs as one pm2 fork process
  (`02-deploy-api.sh:258`). An in-memory map is correct at that scale and needs no schema change.
  If pm2 ever runs in cluster mode it must move to the database; a comment at the map says so.
- **The SSRF guard checks the address at connect time, not before.** It uses `https.request` with a
  custom `lookup` that refuses private, loopback, link-local, CGNAT and ULA addresses. Checking the
  hostname first and fetching afterwards would leave a DNS-rebinding window. Node's built-in
  `fetch` has no per-request lookup hook without adding `undici` as a dependency.
- **Brochure abuse is capped without a vendor.** Two limits: a named `daily` throttler, whose high
  default leaves every other route unaffected, set to 20 per IP per day on `POST /leads/brochure`;
  and a global ceiling of brochure emails per 24 hours counted from `website_leads` (no new table).
  Over either limit, the lead is still saved and staff are still told, by the path that already
  exists for the per-address limit. A CAPTCHA is an open question because it adds a third party,
  a CSP change and front-end work.
- **The CSP goes live in two steps.** First the deploy script fails, instead of warning, when a
  build's inline-script hash is missing from the policy. Only then is the header renamed from
  `-Report-Only` to enforcing.
- **SEO goes live in three steps, none of which can break a route.** The CloudFront function
  `website_spa` (`prime-tracker-main/infra/terraform/website.tf:165`) sends every extensionless
  path to `/index.html`. There is deliberately no distribution-wide 403→`index.html` error
  response, because that once turned API 404s into 200s (`website.tf:347-350`). So "rewrite every
  path, fall back on 403" is not available.
  1. The deploy runs `seo-assets.mjs`. `robots.txt` and `sitemap.xml` have extensions, so the
     function passes them through untouched and they work as soon as they're uploaded.
  2. A CloudFront KeyValueStore is attached to `website_spa`. The function rewrites a path to
     `/<path>/index.html` only when that path is a key in the store, and otherwise to
     `/index.html` exactly as today. While the store is empty, behaviour is unchanged.
  3. The deploy runs `prerender.mjs`, uploads the files, and *then* writes their paths into the
     store. A property published after the last deploy is not in the store, so it gets the
     generic shell, as today, never a 403.
  The CSP hash check must run on the prerendered `index.html`, after `prerender.mjs`, because
  every prerendered file must carry the same two inline scripts.

## Task list

Full task detail (acceptance criteria, verification, files, scope) is in [todo.md](todo.md).

### Phase 0: Baseline
- [x] Task 0: Record the green baseline

### Phase 1: Live bugs and API security (this repo, one PR)
- [x] Task 1: Brochure emails go out even when the flyer URL is invalid
- [x] Task 2: Brochure fetch cannot reach private addresses or attach non-PDFs
- [x] Task 3: Brochure endpoint has a per-IP daily cap and a global daily ceiling
- [x] Task 4: Admin login locks an account after repeated failures
- [x] Task 5: API runtime dependencies upgraded past the critical and high advisories

### Checkpoint A: after Tasks 1–5 (deploy the API)
- [ ] API tests and build green; `pnpm audit --prod` shows no critical or high advisories under `apps__api`
- [ ] Deployed with `02-deploy-api.sh`; `scripts/smoke.mjs` passes; a brochure request for
      centro-plaza from a test address you own delivers the thank-you email
- [ ] Review with the user before Phase 2

### Phase 2: Infrastructure and deploy (both repos)
- [ ] Task 6: Confirm the old Render API is gone and retire `render.yaml`
- [ ] Task 7: Read a week of CSP reports and clear every legitimate violation
- [ ] Task 8: Web deploy publishes `robots.txt` and `sitemap.xml`
- [ ] Task 9: `website_spa` consults a KeyValueStore of prerendered routes (tracker repo; empty store = no change)
- [ ] Task 10: Web deploy prerenders each route's head and registers it in the store
- [ ] Task 11: Web deploy fails, instead of warning, when a CSP hash is missing
- [ ] Task 12: Enforce the CSP (tracker repo)

### Checkpoint B: after Tasks 6–12
- [ ] A share-preview check shows each property's own title and image, and an unknown route and
      a newly published property still load the app
- [ ] The live response has `Content-Security-Policy` (not `-Report-Only`), the home page, a
      property page with its 3D model, and the admin login all work, and the log group shows no
      new `[CSP]` violations for 24 hours
- [ ] Review with the user before Phase 3

### Phase 3: Hygiene
- [ ] Task 13: Privacy policy matches the analytics the site runs (blocked on a client decision)
- [ ] Task 14: Repo root cleanup
- [ ] Task 15: Placeholder brochure links removed from the CMS
- [ ] Task 16: Web toolchain dependencies upgraded
- [ ] Task 17: The API has a linter
- [ ] Task 18: The 579 kB model chunk stays off pages without a 3D viewer
- [ ] Task 19: The 10 MB about video does not load before it's needed

### Checkpoint C: complete
- [ ] All acceptance criteria met; both suites and builds green; `pnpm audit --prod` has no critical or high advisories
- [ ] Docs updated: `docs/seo-setup.md` written, stale Firebase and Render references gone

## Parallelisation

- Tasks 1→2→3 are sequential (same file, `leads.service.ts`). Task 4 (auth) and Task 5 (deps) are
  independent of them and of each other.
- Task 6 is a dashboard check that can happen at any time.
- Tasks 7, 9 and 12 are in the tracker repo; 7 is read-only and can start now. Task 8 is
  independent. Task 10 needs 9 applied (the store must exist). Task 11 needs 10, because the hash
  check must run on prerendered HTML. Task 12 needs 7 and 11.
- Phase 3 tasks are all independent of each other.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `sharp` 0.35 changes behaviour or lacks a prebuilt binary for the EC2 host's arm64 Linux | High: uploads and `/api/img` break | Task 5 runs `media.test.ts`, builds on the host the way the deploy does, smoke-tests `/api/img` and one upload after deploy, and keeps `rollback-api.sh` ready |
| An enforced CSP blocks something report-only never surfaced (an admin-only path, the 404 3D scene, embeds) | High: a broken page for visitors | Task 7 reads a full week of reports covering admin use; Task 10 adds the hard fail; Task 11 is a one-line Terraform revert |
| The CloudFront rewrite sends a valid SPA route to a missing key | Medium: a 403 for that route | The function only rewrites paths that are keys in the store, and the deploy writes keys *after* their files are uploaded; anything else gets `/index.html` as today. Task 9 ships with the store empty, and Task 10 tests five routes, including an unknown one and an unpublished slug |
| A prerendered `index.html` changes an inline script's bytes, so its CSP hash drifts | High once the CSP is enforced: theme and prefetch scripts blocked | Task 10 asserts that every prerendered file's inline-script hashes equal the shell's; Task 11 runs the hash check on the prerendered output |
| The lockout locks out the real admin under attack | Medium | 15-minute lock, no permanent lock, same 401 message (no enumeration), a log line on every lock; documented in Task 4 |
| Throttler named-window change applies to every route | Medium | The `daily` throttler's default limit is far above real traffic; a test asserts that other routes still answer after 50 requests |
| Global brochure ceiling withholds emails for real visitors on a busy day | Low | Default 200 per day (configurable, `BROCHURE_DAILY_CAP`); staff are notified of every withheld email, as today |

## Open questions: answered 16 Nov 2026

1. **Analytics vs privacy policy (Task 13):** **remove analytics.** Delete the Firebase SDK, its
   import and env variables; the CSP's analytics hosts are dropped in the tracker repo with Task 12.
2. **CAPTCHA on public forms:** **honeypot only** (new Task 20). An invisible field plus a minimum
   fill time, checked by the API; no third party, no CSP change, no visitor friction.
3. **MFA for admin:** **not now.** The lockout (Task 4) covers guessing; MFA needs a schema change
   and stays a separate project.
4. **Root backups and `.docx` files (Task 14):** **a gitignored `archive/` folder** in this repo.
5. **Old stashes:** **keep them.**
6. **The 28 Oct plan:** **tick and move to `tasks/archive/2026-10-28/`.**
7. **Render (Task 6):** the user confirms the service is **deleted**.
8. **`#` brochure links (Task 15):** **the user fixes them in the admin**; this repo gets a
   read-only scan script.
9. **Infrastructure (Tasks 7, 9, 10, 12):** Claude writes the code and runs `terraform plan`;
   **the user runs `apply` and the deploys** with the `prime-client` SSO profile.

## Not in this plan

These are older findings from `docs/audit-2026-11-01/security-audit.md` that the 15 Nov report did
not re-raise: M3 (tracker `project:edit` takeover), L1–L6, and rotation of the leaked Supabase
credentials (see notes). They stay tracked there.
