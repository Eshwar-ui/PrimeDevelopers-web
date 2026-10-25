# Code Audit Report — Prime Developers system
**Stack Detected:** Mixed — NestJS + Prisma + PostgreSQL (two APIs), React/Vite SPAs (two), Supabase (website, being retired), AWS via Terraform
**Audit Depth:** Full (Security + Architecture + Scalability)
**Scope:** `prime-tracker-main` (API, web, infra) and `PrimeDevelopers-web` (branch `feat/aws-hosting`: API, web, Supabase migrations, AWS scripts). Read-only review on 24 Oct 2026; nothing was changed. Findings were produced by four parallel reviews and every HIGH finding below was re-checked against the code by hand. No payments or Flutter code exist, so those criteria do not apply.

No CRITICAL findings. 15 HIGH.

---

## 1. Security [High]

### Findings:
- [ ] [HIGH] **Website API on AWS can be reached around CloudFront**, so per-IP rate limits can be spoofed. Port 443 is open to the internet (`prime-tracker-main/infra/terraform/security.tf:15-18`), nginx serves `/website-api/` on the tracker's public host (`scripts/aws/02-deploy-api.sh:96-115`), and the API trusts 2 proxy hops (`02-deploy-api.sh:57`, `apps/api/src/main.ts:24`). A direct caller chooses their own `X-Forwarded-For` and resets the 5/min login limit (`auth.controller.ts:18`) and the lead/brochure limits at will. *Introduced by the 23 Oct AWS move.*
- [ ] [HIGH] **Image resizer is an unauthenticated CPU/memory sink.** `@Public() @SkipThrottle()` (`apps/api/src/modules/media/image.controller.ts:45-47`) and any width 16–2560 / quality 30–95, so roughly 168k cache-missing variants per image, each a full decode on the 914 MB host shared with Prime Tracker. Combined with the finding above, it can take down both products. *Introduced by the AWS move.*
- [ ] [HIGH] **JWT signing secret in the public repo's history is still the secret in use.** Commit `ed95731` (12 Aug) added `JWT_ACCESS_SECRET` to `apps/api/.env.bak`/`.env.example`; the repo is public; the value is byte-identical (by hash) to today's `apps/api/.env`, which points at production. Forging an admin token additionally needs a real admin UUID (random, not exposed), which is why this is not CRITICAL — but the secret must be rotated. The Supabase password and service-role key in the same commit are dead: project `knghxhtfkbswzhphhigy` was deleted (DNS confirmed gone).
- [ ] [HIGH] **Tracker: restricted roles can list every project's financial data.** When a request carries no project id the access guard passes (`common/access/project-access.guard.ts:22`), and list services query `projectId: undefined`, which Prisma treats as no filter. Verified on `GET /sales/forecast` (`sales.controller.ts:45`, no user context). Also reported for `/documents` (with 1-hour signed URLs), `/sales`, `/sales/pipeline`, `/leases`, `/leases/rent-roll`, `/contracts`, `/loans/draws`, `/budgets/revisions`, `/milestones`. Affects the scoped roles (PM, Construction, Sales, Marketing).
- [ ] [HIGH] **Tracker: draws can be approved or funded with edit permission.** `PATCH /loans/draws/:id/status` requires only `draw:edit` (`loans.controller.ts:117-118`) and accepts APPROVED with any `approvedAmount`, or FUNDED, which posts an Actual. The proper state machine requires `draw:approve` (`draws.controller.ts:57-58, 84-85`). On this controller `:id` resolves as a loan id, so draw ids get no membership check (cross-project IDOR).
- [ ] [HIGH] **Tracker: MFA step-up can be bypassed with a stolen access token.** `setupMfa` overwrites `mfaSecret` without checking `mfaEnabled` (`modules/auth/auth.service.ts:342-357`), so setup → enable → verify yields an `mfaVerified` token for the loan and draw routes, and locks the real owner out of their MFA.
- [ ] [HIGH] **Terraform state holds every production secret, unencrypted and world-readable.** `terraform.tfstate.d/client/terraform.tfstate` (mode 644, local backend — `versions.tf:15-21` commented out) contains 8 real SSM SecureString values (database URL, JWT secrets, encryption key, Google client secret, Redis password) plus the RDS master password. The comment at `ssm.tf:3-4` saying secrets never land in state is wrong.
- [ ] [HIGH] **The two products are not isolated on the shared host.** Both run as the `ubuntu` user under one instance role with `ssm:GetParameter` on `/prime-tracker/*` and access to the documents bucket (`iam.tf:26-29, 39-45`). A flaw in the website API exposes the tracker's `.env`, which holds the RDS **master** connection string.
- [ ] [HIGH] **Legacy Supabase policies still treat any signed-in Supabase user as a CMS admin.** `auth.role()='authenticated'` write policies on content, properties and news, read/update/delete on `website_leads`, and storage writes (`supabase/migrations/…06:23-174`, `…11:36-43`, grants in `…07`). Admin login left Supabase Auth in migration 08, but nothing removed these. *Conditional:* whether self-signup is enabled on the live project `nrtqntqutquapydsnjbm` is not in the repo — verify.
- [ ] [MEDIUM] Tracker access and refresh tokens (7-day) are persisted to `localStorage` (`apps/web/src/store/authStore.ts:37-74`); the website admin's refresh token too (`apps/web/src/lib/api.js:47-62`). Any XSS becomes a week-long session.
- [ ] [MEDIUM] Tracker update-board links are stored with no URL-scheme check (`update-board.service.ts:415-420`) and rendered as `href` (`pages/UpdatesPage.tsx:863`) — a `javascript:` link by any user with `updateBoard:create`. Not tested for execution given `target="_blank"`.
- [ ] [MEDIUM] Tracker Google sign-in matches existing users by email only; `emails[0].verified` and a stored `googleId` are not checked, and the domain allow-list applies only to new accounts (`auth.service.ts:153-193`). Tokens are returned in the redirect query string (`auth.controller.ts:80-87`).
- [ ] [MEDIUM] Tracker login is limited per IP only (20/min), with no per-account lockout, and unknown emails return before bcrypt runs, which reveals which accounts exist through timing (`auth.service.ts:87-97`).
- [ ] [MEDIUM] Website: **unpublished CAP/NNN deals are public** — `GET /api/content` returns every section unfiltered (`content.service.ts:14-19`, verified); `published:false` is enforced only in the browser (`CapListingPage.jsx:55`).
- [ ] [MEDIUM] Website brochure endpoint mails any address from `brochures@theprimedeveloper.com` at 10/min per IP, with no captcha, and does not check that the property is published (`leads.controller.ts:33-40`, `leads.service.ts:50-54,120`). Dormant while SES is sandboxed; abusable with the spoofing finding above.
- [ ] [MEDIUM] Tracker IDOR on sale payments (`PATCH/DELETE /sales/payments/:id`, `sale-payments.service.ts:140-168`) and change orders (`contracts.service.ts:85-98`).
- [ ] [MEDIUM] Tracker uploads: no MIME or extension allowlist; the browser's declared type becomes the S3 `ContentType` and downloads have no `Content-Disposition` (`s3.driver.ts:49-54, 71-76`), so uploaded HTML or SVG renders inline.
- [ ] [MEDIUM] Tracker `DEMO_MODE` accepts `Bearer demo-SUPER_ADMIN` whenever `NODE_ENV` is not `production` (`common/guards/jwt-auth.guard.ts:27-42`); `prisma/seed-demo-users.ts:6` creates a SUPER_ADMIN with a known password and no environment guard.
- [ ] [MEDIUM] EC2 allows IMDSv1 (`ec2.tf` has no `metadata_options`; state shows `http_tokens = optional`). Any SSRF in either API can reach the instance role's credentials.
- [ ] [MEDIUM] Tracker connects to RDS as the **master** user (`outputs.tf:50`).
- [ ] [MEDIUM] Migration exports linger: the documents bucket is versioned (`s3.tf:54-59`), so `aws s3 rm` in `scripts/aws/03-copy-content.sh:104` and `04-copy-admins.sh:23,33` only adds a delete marker — the admin password-hash export (if 04 has been run) and the content export remain as old versions. *Introduced by the AWS move.*
- [ ] [LOW] Refresh-token rotation is read-then-update, not atomic, in both APIs (tracker `auth.service.ts:277-308`, website `auth.service.ts:47-59`); the tracker stores refresh tokens in plaintext; neither deletes expired rows.
- [ ] [LOW] Tracker-sync HMAC covers `timestamp.body` but not the query string, so a captured push can be replayed within 5 minutes with `?force=true` (`tracker-signature.ts:20-25`, `tracker-sync.controller.ts:25-28`).
- [ ] [LOW] Website CloudFront minimum TLS is `TLSv1` while it runs on the default certificate (`website.tf:199`); no CSP anywhere; the security-headers policy is not applied to `/api/*`.
- [ ] [LOW] Website `/api/health/ready` returns the raw database error message (`health.controller.ts:43-48`).

### Stack-Specific Checks:
**NestJS**
- [x] Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` — both APIs
- [x] Helmet enabled — both APIs
- [x] CORS explicit allowlist, not `*` — both APIs
- [x] `@nestjs/throttler` configured; stricter on login/refresh/MFA (tracker), login/leads (website)
- [ ] JWT guard global — **website yes; tracker opt-in per controller** (every controller has it today)
- [x] RBAC guards — tracker `@RequirePermissions` on every non-self route; gaps are in project scoping, not permissions
- [ ] DTOs on every endpoint — **tracker: ~50 inline `@Body()` types and 4 `any` bodies bypass validation** (e.g. `cashflow.controller.ts:60,67`, sale payment amounts `sales.controller.ts:310-348`)
- [x] No `$queryRawUnsafe`; raw SQL is tagged-template only
- [x] No stack traces or Prisma errors in responses (tracker); website readiness leaks DB message (above)
- [ ] `enableShutdownHooks()` — **missing in both**
- [x] Health endpoints `/api/health`, `/api/health/ready` — both

**Supabase (legacy, website)**
- [x] RLS enabled on every website table
- [ ] Policies scoped correctly — **no: `authenticated` = admin** (above)
- [x] Admin/auth tables revoked from `anon`/`authenticated` (migrations 10, 14)
- [ ] Storage bucket limits — **`images` bucket public with no size or MIME limit** (`…06:135-137`)
- [x] Service-role key server-side only; not in the browser bundle
- [ ] Leaked keys rotated — **project deleted, so moot; the JWT secret reused in the API is not rotated**

---

## 2. Architecture & Design

### Findings:
- [ ] [HIGH] **Single points of failure:** one `t3.micro` runs both APIs, the tracker SPA and Redis; RDS `db.t3.micro` is single-AZ (`rds.tf:26`) and at its memory limit since the website joined it (alarm `prime-tracker-rds-memory-low`, free memory ~180 → ~125 MB, connections 5 → 8).
- [ ] [HIGH] **A plain `terraform apply` would break production.** The auto-loaded `terraform.tfvars` has a different `db_password` and `admin_cidr` from `client.tfvars` and lacks `enable_website` / `enable_github_deploy` (verified). Without `-var-file=client.tfvars` it would change the RDS master password immediately (`apply_immediately`) and destroy the website distribution and the CI deploy role.
- [ ] [HIGH] **The two tracker deploy paths write different `.env` files.** The CI SSM document (`github-deploy.tf:217-218`) omits `GOOGLE_CALLBACK_URL`, `STORAGE_DRIVER`/`S3_BUCKET`, `MAIL_DRIVER`/`SMTP_FROM`, `WEBSITE_SYNC_*` and sets a single Google domain; `infra/scripts/deploy.sh:157-169` sets them all. Enabling CI deploys would silently break SSO, email, uploads and the website sync.
- [ ] [MEDIUM] Builds are not reproducible: the box resets to `origin/main` HEAD rather than the released SHA (`github-deploy.tf:176,194-196`); `deploy.sh` builds the local tree while the box pulls `main`.
- [ ] [MEDIUM] No rollback path: migrations run before the health check with no snapshot; the website deploy deletes `dist` first (`02-deploy-api.sh:35`) and uses `prisma db push` instead of migrations (`:74`).
- [ ] [MEDIUM] Host configuration lives outside Terraform: the website's nginx snippet is injected by `sed` and is absent from `user-data.sh.tftpl:83-121`; `ignore_changes [ami, user_data]` hides drift. A rebuilt box has no website route.
- [ ] [MEDIUM] Production depends on the third-party `nip.io` DNS service for the tracker and the website API origin (`locals.tf:23`, `website.tf:47`).
- [ ] [MEDIUM] Tracker domain events are an in-process `EventEmitter` fired by `setImmediate` (`common/events/event-bus.service.ts:30-54`): at-most-once, lost on crash or deploy, no retry or outbox — e.g. `drawRequest.funded` → Actual.
- [ ] [LOW] `deploy.sh:15-16` defaults to the old test account's instance and bucket and has no account guard.

### Pattern Violations:
- Tracker `CacheService` claims Reports use it (`cache.service.ts:16`) — `reports.service.ts` does not.
- `PaginationDto` / `paginate()` exist (`common/pagination/pagination.dto.ts`) and nothing imports them.
- `bullmq` is a dependency and `REDIS_PASSWORD` is provisioned, but no queue and no Redis client exist; Redis runs in Docker without a password (`user-data.sh.tftpl:54-56`).

---

## 3. Scalability & Performance

### Findings:
- [ ] [HIGH] **Tracker cannot run a second instance** (needed for any redundancy):
  - 9 `@Cron` jobs with no lock would run twice;
  - notification dedupe is check-then-insert on a non-unique index (`schema.prisma:2292`), so alerts and emails duplicate;
  - socket.io has no Redis adapter and an in-memory `userSockets` map (`main.ts:99`, `notifications.gateway.ts:18`), while the client falls back to polling, which needs sticky sessions;
  - task attachments are on local disk (`tasks.controller.ts:217`);
  - cache, throttler counters and QuickBooks OAuth state are in-process.
- [ ] [HIGH] Unpaginated lists that grow with the business: `GET /leads` across all projects with 6 relations each (`leads.service.ts:111`), `GET /tasks` (`tasks.service.ts:108`), `GET /update-board` company-wide (`update-board.service.ts:86`), daily logs with every reply and photo plus a signed URL per photo (`daily-logs.service.ts:63,89`); also documents, sales, leases, units. `limit` is uncapped on comments, notifications and audit (`?limit=1000000`).
- [ ] [HIGH] Reports are uncached and load whole tables into JavaScript (`reports.service.ts:51-689`); the project dashboard summary loads all actuals and units, then the units again (`projects.service.ts:546,586`); a single project page loads every actual, unit and sale (`projects.service.ts:228`).
- [ ] [MEDIUM] Sequential N+1 work: QuickBooks bill sync, up to 1,000 bills one at a time (`quickbooks.service.ts:318-330`); sale and lease imports with uncapped rows, one backfill per row (`sale-import.service.ts:572`); scheduled notifications send email one recipient at a time.
- [ ] [MEDIUM] `AuditEvent` grows on every non-GET request, has no `[entity, createdAt]` index for the activity feed's `count()`, and is never pruned.
- [ ] [MEDIUM] Website: every public page prefetches `/content`, `/properties` (with each property's full `detail` blob) and `/news` (every full article body), unpaginated (`index.html:66-67`, `properties.service.ts:16-21`, `news.service.ts:9-14`).
- [ ] [LOW] Notification list filters `userId` and sorts `createdAt` with no matching composite index; `SalePayment.interiorProjectId` unindexed.
- [ ] [LOW] Tracker route chunk `ProjectDetailPage.tsx` is 8,788 lines; the checked-in `apps/web/dist` is stale (a single 2.7 MB bundle).

---

## 4. Code Quality

- [ ] Immutable models used: **Not applicable** (TypeScript/Prisma; no model-immutability convention in either codebase)
- [ ] Error handling present: **Mostly** — missing on 5 tracker crons (draw-overdue, sales-stale, stale-units, variance, milestone-overdue); EventBus swallows handler errors; partial writes without a transaction on lease/sale delete (`leases.service.ts:2386-2392`, `sales.service.ts:1531-1536`) and sale-created-as-CLOSED (`sales.service.ts:433-446`)
- [ ] Dead code / unused imports: `PaginationDto`/`paginate()`; `bullmq`; the Redis container; stale tracker `apps/web/dist`; `client.tfplan` in public git history (`640f5db`, exposes `admin_cidr` and `alarm_email`)
- [x] Naming conventions followed: Yes — consistent module/service/DTO naming in both APIs

---

## 5. Production Readiness Checklist

- [ ] Environment variables externalized (no hardcoded secrets) — **Partial.** SSM SecureString, owner-only `.env` files and no secrets in tracked files are all good. But the state file holds every secret, a leaked secret is still in use, and a demo SUPER_ADMIN seed carries a known password.
- [ ] Logging in place — **Partial.** JSON logs and an audit interceptor with redaction exist. But there are no access logs or request ids, no log shipping or retention (the CloudWatch agent collects metrics only), debug lines in production carry full event payloads (buyer, tenant, amounts), and failed logins and 403s are not audited.
- [ ] API rate limiting configured — **Partial.** Configured in both APIs. But the counters are in memory, the website origin can be spoofed, the resizer is exempt, and there is no WAF.
- [ ] Background jobs have retry/failure handling — **No.** No retries, no alerting on cron failure, at-most-once events and no `enableShutdownHooks`.
- [ ] Migrations are reversible — **No.** Prisma migrations are forward-only, there is no pre-migration snapshot, and the website on AWS uses `db push`.

Also present and good:
- RDS is private, encrypted, keeps 30-day backups and has deletion protection.
- SSH is closed, and all S3 buckets block public access with OAC.
- GitHub OIDC is pinned to the repo and environment.
- About 2,400 tracker tests run against real Postgres in CI.
- 11 CloudWatch alarms plus SMS/email and a billing alarm.
- Termination protection and EC2 auto-recover are on.

---

## 6. Priority Action Plan

🔴 **P1 — Fix before anything else**
1. Close the website API origin to everything but CloudFront (secret origin header checked by nginx) and set the proxy-hop trust to match; limit the resizer to the site's fixed width ladder and throttle it. *(AWS-move regressions.)*
2. Rotate `JWT_ACCESS_SECRET` on Render and locally (AWS already uses a different one); everyone signs in once.
3. Tracker authorization: scope every list endpoint to the caller's projects when no project id is given; require `draw:approve` on `PATCH /loans/draws/:id/status` and resolve draw ids correctly; refuse `mfa/setup` when MFA is already enabled without a fresh code.
4. Terraform: `chmod 600` the state now; move it to an encrypted S3 backend with locking; fold `terraform.tfvars` into `client.tfvars` so a plain apply cannot hit production with the wrong values.
5. Delete every version of the migration exports in the documents bucket; make the scripts delete versions, not just objects.
6. Run the website API as its own unix user with no read access to the tracker's `.env` (until Fargate gives it its own task role).

🟡 **P2 — This sprint**
- Paginate the growing lists and cap `limit`. Cache the reports and the dashboard summary.
- Move refresh tokens to httpOnly cookies, add a CSP and a URL-scheme allowlist for links.
- Tighten Google sign-in: verified email, stored `googleId`, domain check on every login. Stop returning tokens in the query string, and add per-account lockout.
- Filter unpublished CAP listings on the server. Validate lead `context`, and require a published property for brochures.
- Enforce IMDSv2. Give the tracker its own database user instead of master. Add `enableShutdownHooks` and try/catch plus alerting on every cron.
- Unify the two tracker deploy paths and deploy the released SHA. Use migrations, not `db push`, for the website. Take a snapshot before migrations.
- Supabase: drop the `authenticated` write/read policies and anon inserts, or retire the project sooner.

🟢 **P3 — Technical debt to track**
- Multi-instance readiness: a worker for the crons, the socket.io Redis adapter, task attachments on S3, Redis-backed cache and throttler, and a unique dedupe key. Covered by `docs/aws-production-plan.md` Phase 2.
- Add an event outbox, audit-log retention and indexes, and fix the N+1 syncs and imports.
- Access logs with request ids, log shipping, and a TLS policy for the domain certificate.
- Remove dead code (`PaginationDto` unused, `bullmq`, the Redis container, the stale `dist`).
