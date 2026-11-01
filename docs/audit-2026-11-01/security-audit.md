# Security and hardening audit: Prime Developers website, 1 Nov 2026

**Scope:** `PrimeDevelopers-web` at `main` 681da20:
- `apps/api` (NestJS + Prisma)
- `apps/web` (Vite + React 19 SPA, admin CMS)
- `scripts/`, `render.yaml`, `supabase/`, `.gitignore`, and git history

For the integration only, it also covers `prime-tracker-main` `apps/api/src/modules/website-sync` and `infra/terraform/website.tf` (plus `waf.tf` and `website-iam.tf`, which `website.tf` depends on).

**Method:** read-only, following the `security-and-hardening` checklist (OWASP, input validation, authn/authz, secrets, headers, least privilege, dependencies, privacy).
- No file in either repo was changed.
- Secrets were never printed. A leaked value was compared to the local one by SHA-256 prefix only, and the result is reported as same or different.
- Live evidence comes from unauthenticated public GETs of `https://dtw8rs0oq8bpp.cloudfront.net`: response headers, `/api/properties`, `/api/content` and `/api/news`. Personal data in those responses was counted, not printed.
- I ran `apps/api` tests (75/75 pass), `apps/web` tests (34/34 pass) and `pnpm audit --prod`. The API tests use fakes and boot no real database.
- No AWS, Render, Supabase or GitHub calls were made, because those need authentication. Anything that depends on them is under "Needs runtime / infra confirmation".

This follows [system-audit-2026-10-24.md](../system-audit-2026-10-24.md) and [website-audit-2026-10-27.md](../website-audit-2026-10-27.md). Items those audits found that are now fixed are listed in §1 and not repeated.

**Counts:**

| Severity | Verified in code | Needs runtime/infra confirmation |
|---|---|---|
| Critical | 0 | 0 |
| High | 1 | 1 |
| Medium | 7 | 2 |
| Low | 11 (L11 is functional) | 4 (R8 to R11) |
| Unrated checks | — | 4 (R3, R4, R6, R7) |

---

## 1. Status of earlier findings

### Fixed (verified in code, and live where noted)

| Earlier finding | Now |
|---|---|
| 24 Oct HIGH: the image resizer is an unauthenticated CPU sink | Fixed. The width ladder and three qualities 308-redirect anything else (`image.controller.ts:32-65,165-171`). A semaphore allows 2 active and 64 waiting with a 20 s deadline (`:47-122`). Throttled at 120/min (`:147`), and CloudFront caches by width and quality only. |
| 24 Oct HIGH: the two products are not isolated on the shared host | Fixed in code. The API runs as its own `prime-website` user (`02-deploy-api.sh:54-55`). It uses a scoped IAM role (`website-iam.tf`), and an iptables rule blocks IMDS for that uid (`02-deploy-api.sh:145-196`). That block is conditional on `APP_ROLE_ARN` existing (see R3). |
| 24 Oct HIGH: legacy Supabase `authenticated` = admin policies | Fixed in the repo by `supabase/migrations/…15_retire_supabase_auth_policies.sql`. Whether it has been applied is not verifiable here (R4). |
| 24 Oct HIGH: the JWT secret in history is still in use | **On AWS, fixed:** the secret is generated fresh in SSM (`01-database.sh:11`). **Locally and on Render, still open** (R1). |
| 24 Oct MEDIUM: refresh token in `localStorage` | Fixed on AWS. It is an HttpOnly, Secure, SameSite=Strict cookie on `/api/auth` (`refresh-cookie.ts:32-40`, `02-deploy-api.sh:86`, `deploy-web-aws.sh:41`), and the browser stores only a marker. |
| 24 Oct MEDIUM: unpublished CAP/NNN deals are public | Fixed by `withoutDrafts` (`content.service.ts:17-27`). Live: 0 `"published":false` items in `/api/content`. |
| 24 Oct MEDIUM: brochure doesn't check that the property is published; lead `context` unbounded | Fixed (`leads.service.ts:144`, `flat-context.ts`). A per-address cap of 3 per day was added (`:166-192`). The remaining brochure risk is M2. |
| 24 Oct MEDIUM: migration exports linger as old S3 versions | Fixed going forward: `purge_s3_key` deletes every version (`lib.sh:67-79`). Exports from before the fix: R6. |
| 24 Oct LOW: refresh rotation is not atomic; rows never pruned | Fixed (`auth.service.ts:72-76,120-123`). |
| 24 Oct LOW: tracker-sync HMAC doesn't cover the query (`?force=true` replay) | Fixed on both sides: path and query are signed (`tracker-signature.ts:24-29`, tracker `website-signature.ts:18-23`). |
| 24 Oct LOW: `/api/health/ready` leaks the DB error | Fixed (`health.controller.ts:50-56`). Verified live. |
| 24 Oct LOW: no security headers on `/api/*` | Fixed. Live `/api/*` carries Helmet's headers (CSP `default-src 'self'`, nosniff, XFO, CORP/COOP) plus the CloudFront managed policy. |
| 24 Oct: no `enableShutdownHooks`; website uses `db push` | Fixed (`main.ts:37`; `02-deploy-api.sh:103-142` migrates after an RDS snapshot). |
| 24 Oct HIGH: origin reachable around CloudFront (XFF spoofing) | Fixed in code: CloudFront sends `X-Origin-Verify` (`website.tf:306-309`) and nginx checks it (`02-deploy-api.sh:206-210`), with WAF rate rules (`waf.tf`). The nginx check is written only if the header was live at deploy time (R2). |
| 27 Oct CRITICAL C1: property editor saves rejected | Fixed by an explicit field whitelist (`apps/web/src/admin/propertyPayload.js`), tested against the DTO. |
| 27 Oct MEDIUM: no server-side conflict check | Fixed: `expectedUpdatedAt` is checked under `FOR UPDATE` (`properties.service.ts:51-85`). |
| 27 Oct MEDIUM: lead spam protection thin; `findAll` unpaginated | Fixed: honeypot and fill time (`leads.service.ts:28-32`), cursor paging (`:458-478`). |
| 27 Oct HIGH: sync doc names the Render URL | Fixed (`docs/tracker-sync-and-aws-plan.md:244-276`). |

### Still open

| Earlier finding | Now |
|---|---|
| 27 Oct HIGH: buyers' names on sold units are public | **Open.** Live: 35 of 35 sold rows carry a `tenant`, and 15 of those are shaped like a person's name. Folded into H1. |
| 27 Oct HIGH: lease rents are public | **Open.** Live: 2 of 6 leased rows expose `rate`. Folded into H1. |
| 27 Oct HIGH: old Render API still live, on the leaked JWT secret | **Open, needs confirmation** (R1). `render.yaml:52` still has `autoDeploy: true`, so every push to `main` redeploys it. |
| 27 Oct MEDIUM: CSP enforcement would break Maps and 3D | **Open.** The live header is still `Content-Security-Policy-Report-Only`, and `frame-src`/`connect-src` are unchanged. See M4. |
| 27 Oct MEDIUM: the privacy policy is wrong about analytics | **Open** (M8). |
| 27 Oct LOW: the public API exposes `trackerProjectId` | **Open.** The key is present on all 6 properties; every value is null today. Folded into H1. |
| 24 Oct LOW: CloudFront minimum TLSv1 | Open until the domain cutover; unavoidable on the default certificate. |

---

## 2. Findings verified in code

### High

#### H1. Public property endpoints serve the whole row and the whole `detail` blob, including personal data, and the tracker sync will add more
- **Where:**
  - `apps/api/src/modules/properties/properties.service.ts:16-31`: `findAll` and `findBySlug` return the full Prisma row.
  - `properties.controller.ts:18-32`: `@Public()`.
- **What is public today.** Verified live, counts only:
  - every `unitList[].tenant`: 35/35 sold rows, 15 of them person-name-shaped;
  - `rate` on leased rows (2/6);
  - `trackerProjectId` and `trackerSyncedAt`;
  - the whole `siteModel` binding map;
  - any key an editor ever puts into `detail`. `property.dto.ts:83-86` leaves `detail` as `@IsObject()` with no allowlist.
- **What the sync adds on its first real run:**
  - `tracker-merge.ts:657-671,703` writes `row.tracker = { ids, unitNumber, status, sqft, unitType, availableSince, occupant }` and `trackerUnitIds` into each public row. These are the tracker's internal unit cuids, plus the occupant.
  - `:698` copies `occupant` into the public `tenant`.
  - On the tracker side, `website-snapshot.ts:79-82` sends `tenantBrand || tenantName`. A lease with no brand therefore publishes the lessee's legal name, which can be an individual. That contradicts the file's own comment that it is "the privacy boundary".
- **Failure scenario:** anyone can run `curl /api/properties` and harvest private buyers' and lessees' names and rents. The data is also cached publicly (`s-maxage=60`). Once the sync is live, tracker ids leak too, and any field later added to `row.tracker` (asking rent and price are already accepted by `snapshot.dto.ts:68-72`) becomes public by default.
- **Fix:**
  1. Add a public serializer in `PropertiesService`, used only by the public controller. It allowlists top-level columns (drop `trackerProjectId` and `trackerSyncedAt`).
  2. For each unit it emits only display fields: label, status, size, images, description, logo, `tenantCategory`/`tenantUrl`, and placement. Drop `tracker`, `trackerUnitIds` and building `trackerBuildingId`.
  3. Emit `tenant` only for `leased` rows. Emit `rate` only for `available` and `coming-soon` rows.
  4. In the tracker, send `tenantBrand` only, never `tenantName`.
  5. Add a test asserting that the public JSON has none of the dropped keys.
  6. Then clear the 15 buyer names and 2 rents from the data, after the client decides.

### Medium

#### M1. Server-side fetch of a CMS-supplied URL, with the response mailed to an address the requester chooses (SSRF and exfiltration channel)
- **Where:** `apps/api/src/modules/leads/leads.service.ts:109-124` (picks `detail.overview.flyer` or any `resourceLinks[].url`) and `:225-252` (`fetch(flyerUrl)`, `:233`). There is:
  - no scheme or host allowlist;
  - the default `redirect: 'follow'`;
  - the response bytes and the remote `Content-Type` are attached to the email sent to `dto.email` on the public `POST /api/leads/brochure`.
- **Exploit:** someone holding an admin session sets a property's flyer to `http://127.0.0.1:3001/api/...` (the tracker API on the shared host, bypassing nginx and CloudFront), any VPC-internal HTTP service, or an external URL that 302s to one. They then POST `/api/leads/brochure` with their own email and receive the internal response as an attachment. That admin session can come from a phished admin or from XSS (M4 makes XSS impactful).
  - IMDSv2 (needs PUT) and the iptables block (R3) keep instance credentials out of reach.
  - Everything else bound to localhost or the VPC is readable.
  - The live data has no exploitable value today: all three flyers are `"#"`. That makes `fetch` throw, so no brochure email is ever sent (a separate functional bug, L11).
- **Fix:**
  1. Only attach files the site itself stores. When the URL starts with `MEDIA_PUBLIC_BASE + '/media/documents/'`, read the object with `MediaStorage.get('documents', path)` and never fetch over HTTP.
  2. Otherwise send the link in the body, not an attachment.
  3. If an HTTP fetch must stay: https only, a host allowlist, `redirect: 'error'`, and a resolved-IP check that rejects private, loopback and link-local addresses.
  4. Validate `overview.flyer` and `resourceLinks[].url` on save.

#### M2. The brochure endpoint is an unauthenticated mail relay carrying attacker text, with unbounded per-request memory
- **Where:**
  - `leads.controller.ts:33-40` (public, 10/min per IP);
  - `leads.service.ts:137-276`: `"Hi ${dto.name},"` at `:255`; `name` is free text up to 200 characters;
  - 8 MB buffered per request (`:12,235`), plus a base64 copy (`mail.service.ts:153`), with no concurrency limit;
  - pm2 restarts at 300 MB (`02-deploy-api.sh:259`).
- **Exploit, abuse:** rotate recipient addresses (the 3/day cap is per address) and set `name` to a phishing line. The company's own domain then mails it to arbitrary inboxes. This is dormant only while SES is sandboxed (R7).
- **Exploit, DoS:** once a real flyer exists, a dozen concurrent requests from a few IPs (WAF allows 100 per 5 min per IP) buffer more than 300 MB and restart the API. It runs on the t3.micro it shares with the tracker.
- **Fix:**
  1. Send a link instead of an attachment, or cache the attachment once per property.
  2. Put the send behind a small `Gate` (like `image.controller.ts:82`).
  3. Add a global daily send cap.
  4. Reject URLs and line breaks in `name`.
  5. Add a CAPTCHA or Turnstile, or double opt-in, before production SES access is granted.

#### M3. Any tracker user with `project:edit` on any project can take over the unit inventory of any website property not yet linked
- **Where:**
  - Website: `tracker-sync.service.ts:120-140` links by `websiteSlug` on first push, with no allowlist.
  - Tracker: `websiteSlug` is settable with `project:edit` (`projects.controller.ts:130-132`, `update-project.dto.ts:14-16`). A forced push needs only `project:edit` (`website-sync.controller.ts:29-38`).
  - Live: all 6 website properties have `trackerProjectId: null`, so all 6 are claimable.
- **Exploit:** a scoped project manager sets their own project's `websiteSlug` to `pow-leander`. The cron (every 5 minutes) links it and rewrites that public listing's units, statuses and totals. With `?force=true`, it also removes rows past the guard.
- **Fix:**
  1. On the website, require the link to exist first: an admin sets `trackerProjectId` in the CMS, and the sync refuses a slug-only claim (404/409).
  2. On the tracker, require an admin-level permission (e.g. `website:publish`) to set `websiteSlug` and to use `force`.

#### M4. The CSP is still Report-Only, so any script injection on the site origin yields an admin access token
- **Where:**
  - `prime-tracker-main/infra/terraform/website.tf:269` sends the header name `Content-Security-Policy-Report-Only`. Confirmed live on `/` and on `/media/*`.
  - In cookie mode, `POST /api/auth/refresh` returns an access token to any same-origin script (`auth.controller.ts:45-61`). The HttpOnly cookie protects the refresh token but not the session.
- **Blockers to enforcing,** beyond the 27 Oct list:
  - `frame-src` (`website.tf:223`) lacks `https://www.google.com` (Maps: `ContactPage.jsx:180`, `PropertyDetailPage.jsx:874`) and `https://www.instagram.com` (Instagram embeds: `apps/web/src/lib/video.js:41`).
  - `connect-src` (`:221`) lacks `blob:` (GLB textures).
- **Fix:** add those three sources, watch `/api/csp-report` for a few days, then rename the header to `Content-Security-Policy`. Also:
  - add `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - at cutover, add `includeSubDomains` to HSTS once the subdomains are known.

#### M5. Vulnerable dependencies on reachable paths (`pnpm audit --prod`: 1 critical, 20 high, 15 moderate, 4 low)
Triage by reachability:

| Package (installed) | Reachable? | Action |
|---|---|---|
| `body-parser` 1.20.4 (via express 4.22.1): DoS from trailing bytes after a compressed body, GHSA-27r3-jxmh-p828 | **Yes.** Every unauthenticated JSON POST (`/api/leads`, `/api/leads/brochure`, `/api/csp-report`, `/api/auth/login`); bodies are parsed before guards. | Add a `pnpm.overrides` entry `body-parser >=1.20.9`, or move to express ≥4.22.x with it. |
| `qs` ≤6.16.0: several DoS advisories, GHSA-6pq8-jhm2-2vcw and others | **Likely.** Express parses every query string with qs. | Override `qs >=6.16.1`. |
| `sharp` 0.34.5: libvips, libheif and librsvg CVEs, GHSA-f88m-g3jw-g9cj, -rgj7-g3m4-5g8c, -wq5f-xc86-pv6w | **Admin uploads**, where `sharp(buffer).metadata()` autodetects the format, so SVG bytes labelled `image/png` reach librsvg (`uploads.service.ts:71`). **Public resizer**, but only on stored originals. | Upgrade to `sharp >=0.35.5`. |
| `multer` 2.0.2: 8 DoS advisories | Authenticated only. Guards run before `FileInterceptor` (`uploads.controller.ts:33`). | Upgrade to `>=2.5.0`. |
| `proxy-addr` (critical, IPv4-mapped IPv6 trust subnet) | **No.** `trust proxy` is a hop count (`main.ts:24`), not a subnet list. | Override anyway (`>=2.0.8`). |
| lodash (`@nestjs/config`), js-yaml (`@nestjs/swagger`, docs disabled in prod: `/api/docs` returns 404 live), vite, nanoid and source-map-js (build-time), `@grpc/grpc-js` and re2js (Firestore, unused) | No / build-time | Routine bumps. |

#### M6. Admin authentication: one password guards all lead PII and site publishing, with no MFA or per-account lockout
- **Where:**
  - `auth.controller.ts:36-37`: 5 attempts per minute, per IP only. The WAF allows 100 per 5 minutes per IP on `/api/auth/`.
  - `auth.dto.ts:9-12` and `prisma/seed-admin.ts:38`: the minimum length is 8, while `05-add-admin.sh:19` and `create-admin.mjs` require 12.
  - There are no roles: every `website_admin_users` row can read, export or delete every lead and publish anything.
- **Exploit:** distributed password guessing or credential stuffing from many IPs is never locked out per account.
- **Fix:**
  1. Count failed attempts per account in the DB, with exponential backoff and a temporary lock.
  2. Raise the floor to 12 in `LoginDto` and `seed-admin.ts`.
  3. Add TOTP for admins.
  4. Later, add a read-only "sales" role for leads.

#### M7. Firebase Analytics and Performance run while the privacy policy says no analytics exist
- **Where:** `apps/web/src/lib/firebase.js:44-64` loads Analytics and Performance in every production build. `pages/PrivacyPage.jsx:93-104` says analytics would be announced "before it is switched on". There is no consent gate. Still open from 27 Oct.
- **Risk:** a misrepresentation in a published policy (FTC Act §5 and state-law exposure), and GA identifiers set without notice.
- **Fix:** update the policy now. Gate `startMeasurement()` behind a consent choice, or remove Analytics.

### Low

#### L1. A CMS URL reaches `window.open` without a scheme check, and there is no server-side URL validation anywhere
- **Where:**
  - `pages/PropertyInfoPage.jsx:793`: `window.open(link.href, …)`. React 19's `javascript:` URL blocking, which covers `href`/`src`, does not apply to `window.open`.
  - CMS URL fields are free text: `property.dto.ts:83-86` (the `detail` blob), `content.dto.ts:12-15`. Markdown links are scheme-checked (`Markdown.jsx:99`).
- **Fix:** check `/^https?:\/\//` before `window.open`. Validate URL-typed fields (`overview.flyer`, `resourceLinks[].url`, `links[].href`, video URLs) on save, https only.

#### L2. Error and version disclosure
- `image.controller.ts:185` returns libvips error text in a 422.
- Live `/api/*` sends `server: nginx/1.18.0 (Ubuntu)`.
- **Fix:** return a generic 422 message and log the detail. Set `server_tokens off;` in the tracker's nginx config.

#### L3. Admin API responses can be stored by the browser
Only `content.admin.controller.ts:18` sets `Cache-Control: private, no-store`. `/api/admin/leads` (all enquirers' contact details), `/api/admin/properties`, `/api/admin/news` and `/api/auth/*` send none. **Fix:** a small interceptor that adds `no-store` to every non-`@Public` route.

#### L4. JWT hygiene
- Tokens carry no `iss`/`aud` (`auth.service.ts:95-101`), and verification doesn't require them (`jwt.strategy.ts:24-28`). Admin UUIDs are identical on Render and AWS (`04-copy-admins.sh:73-77`), so environments are separated only by their secrets.
- Secret strength is not checked (`app.module.ts:44-53` checks presence only).
- Refresh rotation never ends, so a session lives forever if used weekly (`auth.service.ts:106-115`).
- **Fix:** sign and verify `iss`/`aud` per environment, require a secret of at least 32 bytes at boot, and add an absolute session lifetime (e.g. 30 days) recorded on the first token.

#### L5. Tracker-sync transport and ordering
- The tracker accepts an `http://` `WEBSITE_SYNC_URL` (`website-sync.service.ts:61`). The signature still protects integrity, but tenant names would travel in clear.
- The website applies a snapshot without checking that `generatedAt` is newer than the last one applied (`tracker-sync.service.ts:51-111`). A delayed push, or a replay within the 5-minute window (`tracker-signature.ts:21`), can roll statuses back.
- **Fix:** require https. Reject a snapshot whose `generatedAt` is not newer than the last applied (store it on the property or in `website_tracker_syncs`).

#### L6. Personal data in logs, and no retention
- `leads.service.ts:201` logs the visitor's email on a failed send.
- `mail.service.ts:75-79` logs the subject, which carries the visitor's name, and the recipient while mail is disabled.
- Leads, including spam-flagged ones, are kept forever and have no deletion or retention policy.
- **Fix:** log lead ids, not addresses. Purge spam-flagged leads after 30 days. Set a retention period for leads and CloudWatch, and document it in the privacy policy.

#### L7. Database credentials on the shared host's process list
`01-database.sh:61` and `02-deploy-api.sh:106-107` pass `postgresql://prime_website:<password>@…` as a psql argument, readable by any user on the box through `ps` while it runs. `04`/`05` already use `PGPASSWORD`. **Fix:** use `PGPASSWORD` or a `.pgpass` file there too.

#### L8. The website IAM role can delete media it never needs to delete
`website-iam.tf:43` grants `s3:DeleteObject` on `media/*`, and the API has no delete path. **Fix:** drop the permission. Versioning already allows recovery, but least privilege should hold.

#### L9. Re-running the content copy script destroys sync history and AWS-side edits
`03-copy-content.sh:79` truncates `website_tracker_syncs, news, properties, content` and reloads them from Supabase. `website_tracker_syncs.previous_floor_plans` is the sync's only rollback copy. `:72` also reads a stale path (`/home/ubuntu/prime-website/...`). **Fix:** refuse to run once `properties.updated_at` on RDS is newer than in Supabase, or once any `website_tracker_syncs` row exists. Mark the script as one-shot.

#### L10. Missing hardening headers on the SPA
The SPA (default behaviour) has no `Permissions-Policy`, `Cross-Origin-Opener-Policy` or `Cross-Origin-Resource-Policy`; `/api/*` has them from Helmet. **Fix:** add them to `aws_cloudfront_response_headers_policy.website_site`.

#### L11. Functional, found on the way: brochure emails never send
All three `overview.flyer` values are `"#"`. `fetch("#")` throws inside `sendBrochureEmail` before `mail.send` (`leads.service.ts:233`). Every brochure request answers `emailed:false`, and staff get a "NOT emailed" note. **Fix:** treat non-absolute flyer values as "no brochure". M1's fix covers this.

---

## 3. Needs runtime / infra confirmation

#### R1 (High). The leaked JWT signing secret is still in use outside AWS, and the Render API may still be live on it
- **Verified here:**
  - Commit `ed95731` (12 Aug 2026) added `apps/api/.env.bak` (and modified `apps/api/.env.example`) with `JWT_ACCESS_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`. It is still reachable from `main` and `origin/backup/wip-2026-10-29`.
  - By hash comparison only, the local `apps/api/.env` `JWT_ACCESS_SECRET` is **identical** to the leaked one.
  - The local `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` **differ** from the leaked ones; those leaked values belong to the deleted project.
  - `render.yaml:52` still has `autoDeploy: true`, and `:112-113` still allows the live CloudFront origin in CORS.
  - The AWS deployment uses its own SSM-generated secret (`01-database.sh:11`), so the AWS site is not exposed by this.
- **To confirm:**
  1. Whether `prime-developers-api.onrender.com` is still up and connected to Supabase `nrtqntqutquapydsnjbm`, which holds leads PII up to 25 Oct.
  2. Which `JWT_ACCESS_SECRET` it runs with.
  3. Whether the GitHub repo is public (the 24 Oct audit says it is).
- **Exploit:** with the public secret, anyone who learns one admin UUID (identical on AWS and Render) can forge admin tokens for Render: read, alter or delete every lead there and rewrite that copy of the site data.
- **Fix:**
  1. Suspend the Render service, or at least turn off `autoDeploy` and rotate its secret.
  2. Rotate the local secret.
  3. Export, then pause, the Supabase project.
  4. Only then purge history (`git filter-repo`) and force-push, if the repo stays public.

#### R2 (Medium if not live). Origin lock
- **Where:** the nginx `X-Origin-Verify` check is written only when the header was live in CloudFront at deploy time (`02-deploy-api.sh:25-28,206-210`).
- **Confirm:** a direct `GET https://<nip.io host>/website-api/api/health` without the header returns 403.
- **If not:** callers choose their own `X-Forwarded-For`, which defeats every per-IP throttle (`main.ts:24`, trust 2).

#### R3. Website IAM role and IMDS block
- **Where:** the IAM role and the IMDS block are applied only when `/prime-tracker/website/APP_ROLE_ARN` exists (`02-deploy-api.sh:24,145-196`).
- **Confirm:** `/srv/prime-website/.aws/creds.json` is fresh and the iptables `--uid-owner prime-website -d 169.254.169.254 -j REJECT` rule is present.
- **If not:** the website process holds the instance role, which can read every `/prime-tracker/*` secret, and any SSRF (M1) or RCE reaches it.

#### R4. Supabase project state
- **Confirm:**
  - migration 15 is applied on `nrtqntqutquapydsnjbm`;
  - email sign-up is disabled;
  - the `images` bucket now has its MIME and size limit.
- Then export the project and pause it. It is no longer the production data path, but it holds every lead from before the cutover.

#### R5 (Medium). Uploaded and copied media are served from the site's own origin, with whatever content type was stored
- **Where:**
  - `/media/*` uses the SPA's default behaviour and headers: CSP is report-only, and there is no `Content-Disposition`. Verified live.
  - `03-copy-content.sh:54-58` copied every public Supabase object with the MIME type Supabase recorded. The Supabase `images` bucket had no MIME limit until migration 15.
  - Today's upload path refuses SVG and HTML and checks magic bytes (`uploads.service.ts:16-21,56-78`). The 3 public JSON payloads reference no `.svg`/`.html` media.
- **Confirm:** run an S3 inventory of `media/` for content types outside `image/{jpeg,png,webp,avif}`, `application/pdf` and `model/gltf-binary`.
- **Exploit if any exist:** an `image/svg+xml` or `text/html` object runs script same-origin. It calls `/api/auth/refresh` (the cookie is sent) and gets an admin token.
- **Fix, regardless of the inventory result:**
  1. Add a `/media/*` cache behaviour with a response-headers policy: `Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox` and nosniff.
  2. Add `Content-Disposition: attachment` for non-image types.
  3. Longer term, serve media from a separate cookieless hostname.

#### R6. Pre-fix migration exports
The admin-hash and content exports written before `purge_s3_key` existed may survive as noncurrent versions in `prime-tracker-documents-056836825737` under `migration/`. **Confirm** with `list-object-versions --prefix migration/` and delete them.

#### R7. Email
SES sandbox status, and SPF/DKIM/DMARC for `brochures@theprimedeveloper.com`. The domain's MX is Google Workspace. M2 must be fixed before requesting production access.

#### R8 (Low). Database least privilege
`prime_website` likely retains the default `CONNECT` on the tracker's database. `create-app-db-user.sh:72-73` revokes website access for the tracker login, but nothing revokes `PUBLIC` connect on the tracker DB. On Postgres 15 that exposes the catalog only (schema, role and function names), not rows. **Fix:** `revoke connect on database <tracker_db> from public;` then grant it to the tracker logins explicitly.

#### R9 (Low). Terraform state
The `ORIGIN_SECRET` lands in state (`website.tf:144-148`). The local `terraform.tfstate.d/client/terraform.tfstate.backup` (156 KB, mode 600) still exists beside the S3 backend. Confirm the S3 backend is in use, then delete the local backup.

#### R10 (Low). Detection
No CloudFront logs and no alarm on 401/403/429 bursts on `/api/auth/*` or `/api/integrations/*`; failed logins are not audited. Carried from 27 Oct.

#### R11 (Low). Dev convenience that points at production
`apps/api/.env` points at the production Supabase project (pooler host `aws-0-…`). Running anything from `apps/api` (e.g. `create-admin.mjs`, `prisma db pull`) hits it. Keep a separate `.env.production-supabase` and a scratch default.

---

## 4. What is solid
- **Authentication is the default:** the global `JwtAuthGuard` is fail-closed, and `@Public()` appears only on public reads, leads, login/refresh/logout, health, the image resizer, the CSP report and the HMAC-guarded sync. The `JwtStrategy` re-reads the user on every request.
- **Input validation:** a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` covers every body DTO. Top-level property, news and lead columns cannot be mass-assigned (`trackerProjectId`, `spam` and `status` are not settable from public input).
- **Database queries:** raw SQL appears only as tagged templates (`leads.service.ts:465`, `properties.service.ts:62`, `tracker-sync.service.ts:54`), and there is no `$queryRawUnsafe`.
- **Passwords and tokens:** bcrypt with 12 rounds and a constant-time dummy compare for unknown emails. Refresh tokens are opaque, stored as SHA-256 hashes, rotated atomically, revoked across all sessions on reuse, and pruned.
- **Uploads:** admin-only (the guard runs before multer), 10 MB, a type allowlist without SVG, magic-byte or decode checks, random UUID names, and folder sanitising.
- **Tracker sync:** HMAC-SHA256 over timestamp, path, query and raw body, with `timingSafeEqual`, ±5 minutes, and verification in a guard before validation. A strict DTO, a row lock and a removal guard.
- **Image resizer:** path traversal is rejected (`..` and empty segments) and only the `images` bucket is served.
- **CORS:** an explicit single-origin allowlist. Verified live: no `Access-Control-Allow-Origin` for a foreign `Origin`.
- **Web XSS:** the web app has no `innerHTML` sink except JSON-LD, whose `<` is escaped (`Footer.jsx:92`, `usePropertyHead.js:7,94`). The Markdown renderer emits React elements with a scheme allowlist. React 19.2.8 blocks `javascript:` in `href`/`src`.
- **Secrets hygiene:** `.gitignore` denies `.env*` by default. The tracked env files are `.env.example` placeholders and the public VITE URLs in `apps/web/.env.development`. No production sourcemaps are built.

## 5. Suggested order
1. **Today:** R1 (Render plus secret rotation), H1 (public serializer, then data cleanup), M3 (refuse slug-only claims).
2. **This week:**
   - M4 (CSP fixes, then enforce) together with R5 (the `/media/*` headers policy);
   - M1 and M2 (brochure: S3 read, no remote fetch, concurrency gate);
   - M5 (pnpm overrides and the sharp/multer bumps);
   - confirm R2, R3 and R6.
3. **Before the domain cutover:** M6 (per-account lockout, then TOTP), M7 (privacy policy and consent), L3, L4, L5, L10, R8, R10.
