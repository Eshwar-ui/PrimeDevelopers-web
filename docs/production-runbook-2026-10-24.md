# Production runbook — audit fixes of 24 Oct 2026

Applies the fixes from [`system-audit-2026-10-24.md`](system-audit-2026-10-24.md) to
production. **Render, Firebase and Supabase are out of scope for now** (as asked):
nothing here touches them, and the Supabase-only fix (migration 15) is parked at the
end.

Every command runs on Kalyan's machine with the production login:

```bash
aws sso login --profile prime-client
export AWS_PROFILE=prime-client
```

Each step says what changes, whether anything goes down, and how to check it. Do them
in order — later steps depend on earlier ones.

| Step | Downtime | Repo / branch |
|---|---|---|
| 1. Move Terraform state off the laptop | none | prime-tracker `fix/audit-infra` |
| 2. Origin secret | none | PrimeDevelopers-web `fix/audit-website` |
| 3. `terraform apply` | none (RDS changes wait for Monday) | prime-tracker `fix/audit-infra` |
| 4. Deploy the website API | ~5 s, website API only | PrimeDevelopers-web `fix/audit-website` |
| 5. Deploy the website front end | none | PrimeDevelopers-web `fix/audit-website` |
| 6. Deploy the tracker API | ~10 s; **everyone signs in again** | prime-tracker `fix/audit-combined`, merged |
| 7. Tracker off the master DB login | ~10 s | prime-tracker |
| 8. Monday 08:00–09:00 UTC | **5–10 min, both products** | automatic |
| 9. Clean-up | none | — |

---

## 1. Move Terraform state off the laptop

The state holds every production secret and has lived only in files on this Mac.

Steps 1 and 3 run in `prime-tracker-main` on `fix/audit-infra`, because the local state
files and `client.tfvars` are there and nowhere else. Its `infra/` is identical to
`fix/audit-combined`'s.

```bash
cd ~/Client-project/prime-tracker-main
git switch fix/audit-infra
infra/scripts/bootstrap-state-backend.sh
```

Creates `prime-tracker-tfstate-056836825737` (private, versioned, encrypted, TLS only)
and the `prime-tracker-tflock` table, then copies both workspaces' state up.
**Check:** `cd infra/terraform && terraform workspace show` prints `client`, and
`terraform plan -var-file=client.tfvars` runs. Only then delete the local copies the
script prints.

## 2. Origin secret

```bash
cd ~/Client-project/PrimeDevelopers-web
git switch fix/audit-website
scripts/aws/01-database.sh
```

Re-runs safely; the only new thing it does is create `/prime-tracker/website/ORIGIN_SECRET`,
which step 3 reads. **Check:** it prints `created /prime-tracker/website/ORIGIN_SECRET`
(or nothing new, if it already existed) and ends with `connected as prime_website`.

## 3. `terraform apply`

```bash
cd ~/Client-project/prime-tracker-main/infra/terraform
terraform plan -var-file=client.tfvars -out=audit.tfplan
terraform apply audit.tfplan && rm audit.tfplan
```

Read the plan before applying. Expected, and nothing else:

- **Created:** WAF web ACL, CloudFront function `website-spa`, response headers policy
  `website-site` (the report-only CSP), website IAM role + its SSM
  parameter, RDS parameter group, monitoring role and log group, host log groups,
  5xx metric filter and alarm, website health check and alarm, bucket versioning and
  lifecycle rules, `terraform_data.account_guard`.
- **Changed in place:** the website CloudFront distribution (origin header, function,
  WAF, headers), the EC2 instance (`metadata_options` only — no restart), the RDS
  instance (shown as changing; it is scheduled, not applied), every alarm (`ok_actions`),
  the CloudWatch agent config, the CI deploy document.
- **Must not appear:** any `destroy`, or a replacement of `aws_instance.api` or
  `aws_db_instance.main`. If either does, stop.

**Check:**
- `curl -sI https://dtw8rs0oq8bpp.cloudfront.net/properties/centro-plaza` → `200`, HTML.
- `curl -s -o /dev/null -w '%{http_code}' https://dtw8rs0oq8bpp.cloudfront.net/api/properties/does-not-exist` → `404` (it used to be a 200 HTML page).
- `aws rds describe-db-instances --db-instance-identifier prime-tracker-db --query 'DBInstances[0].PendingModifiedValues'` lists the class and Multi-AZ change.

## 4. Deploy the website API

```bash
cd ~/Client-project/PrimeDevelopers-web
scripts/aws/02-deploy-api.sh
```

The first run on the new layout also:
- creates the `prime-website` Linux user and `/srv/prime-website`;
- moves the process off ubuntu's pm2;
- switches it to the website-only IAM role, with the metadata service blocked for that user;
- records the Prisma baseline on the AWS database.

nginx starts refusing anything without CloudFront's header. The script rolls itself
back if the new release is unhealthy.

The API also starts keeping the admin refresh token in an HttpOnly cookie
(`REFRESH_COOKIE=true`). An admin who reloads the admin between this step and step 5
is signed out, because the old front end does not know about the cookie. Run step 5
straight after this one.

**Check:** the script ends with:
- `direct, no header: 403`
- `direct, with header: 200`
- `tracker: 200`
- `scoped credentials in place`

Then the site loads at https://dtw8rs0oq8bpp.cloudfront.net.

## 5. Deploy the website front end

```bash
scripts/deploy-web-aws.sh
```

Ships the admin's new `/admin/content` read path, the cross-tab refresh lock and
cookie mode (`VITE_REFRESH_COOKIE=true`, matching step 4). Every admin signs in once
more: a refresh token saved in the browser before today is no longer sent.

**Check:**
- Sign in at `/admin/login` (after `scripts/aws/04-copy-admins.sh` if not yet run).
- In DevTools → Application:
  - Cookies shows `pd_refresh`, marked HttpOnly and Secure, with path `/api/auth`.
  - Local Storage `pd.admin.refresh` holds only the word `cookie`.
- Reload: you stay signed in.
- Edit and save a CAP/NNN draft, and confirm it is still there after reload.
- Confirm the public CAP page does not list it.
- Sign out, reload: you are signed out, and the cookie is gone.
- The deploy printed no `warning: the live CSP lacks …` line. If it did, the inline
  scripts changed: add the printed hash to `website_inline_script_hashes` in
  `website.tf` and apply.

**Then, for a week:** the site sends a report-only Content-Security-Policy. Nothing is
blocked; each violation lands as a `[CSP]` line in the `/prime-tracker/app/website-api`
log group. Check it with:

```bash
aws logs filter-log-events --log-group-name /prime-tracker/app/website-api \
  --filter-pattern '"[CSP]"' --start-time $(( ($(date +%s) - 7*86400) * 1000 )) \
  --query 'events[].message' --output text | sort | uniq -c | sort -rn | head -30
```

Browser extensions cause some reports (`chrome-extension:`, `moz-extension:`); ignore
those. Anything from the site's own pages means a source is missing from
`website_csp`. When only extension noise remains, rename the header in `website.tf`
from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and apply.

## 6. Deploy the tracker API

The four tracker audit branches (infra, auth, authz, hardening) are merged as
`fix/audit-combined`, on top of `feat/website-sync`. Merge that PR first, then deploy
from the merged, pushed commit:

```bash
cd ~/Client-project/prime-tracker-main
infra/scripts/deploy.sh api
```

Runs the auth and hardening migrations.

**What users will notice:**
- Everyone is signed out once, because refresh tokens are now stored hashed.
- After 10 wrong passwords an account locks for 15 minutes; an admin password reset unlocks it.
- Google sign-in requires a verified email that matches the linked account.
- Project Managers, Construction, Sales and Marketing users see only their own
  projects on every list, report and dashboard. Before, leaving out the project
  filter showed them every project. Someone who also holds a leadership or finance
  role is now scoped on dashboards and cash flow too.
- Approving, funding or rejecting a draw needs the `draw:approve` permission on
  every route, and a draw can only move along its normal steps.
- Update-board links must be http, https, mailto or tel. Any other link already
  stored shows as plain text.
- Uploads must be a photo, PDF, Office or CSV/text file, a DWG/DXF drawing, a ZIP, an
  email (EML/MSG) or an MP4/MOV clip. HTML, SVG, scripts, macro-enabled Office files
  and files with no extension are refused.
- Only photos and PDFs open in the browser. Word, Excel, CSV, text, HEIC and TIFF
  files download instead, including ones uploaded before today.
- Deleting an active lease or a closed sale puts its unit back to AVAILABLE. A
  building-level closed sale is the exception: deleting it releases no units, because
  someone has to decide which ones go back on the market.
- **The first 08:00 UTC stale-units run sends one alert for every unit that has been
  vacant 90 days or more.** The old job alerted only on the exact day a unit crossed
  90/120/180/365 days, so most of these were never sent. After that, a unit alerts
  once when it crosses the next threshold. Tell the sales team to expect it.

The migrations (all forward-only, applied by `deploy.sh`):
- `20261024000000_auth_hardening`: hashed refresh tokens and the login lockout. It
  deletes every refresh token, which is why everyone signs in again.
- `20261024000000_task_attachment_storage_path`: task attachments move to S3. Old
  attachments are still read from the instance's disk.
- `20261024010000_notification_pending_dedupe_unique`: at most one unread copy of each
  recurring alert per person. Duplicates already there keep their rows; the older
  copies stop counting as the pending one.
- `20261024020000_audit_notification_sale_payment_indexes`: three indexes.
- `20261024030000_unit_vacancy_alerts`: what the stale-units job has already alerted.

Audit history older than two years is now deleted nightly, in small batches. Document
purges, historical deletions and the retention job's own records are kept.

The website sync signs with the new format, which step 4 already accepts.

**Check:** `curl https://3-232-150-154.nip.io/api/health/ready` returns `ok`, then sign
in to the tracker.

## 7. Tracker off the master database login

```bash
infra/scripts/create-app-db-user.sh
infra/scripts/deploy.sh api
```

Creates `prime_tracker_app` (data only, no schema changes, no access to the website
database) and moves `DATABASE_URL` to it; migrations keep the master login as
`MIGRATE_DATABASE_URL`. **Undo, before the deploy:** put the master URL back into
`/prime-tracker/DATABASE_URL`.

## 8. Monday 08:00–09:00 UTC (13:30–14:30 IST)

RDS moves to `db.m7g.large` (8 GB) with a standby in a second AZ, and picks up its
new parameter group. **Both products are unavailable for 5–10 minutes** while the
instance restarts. Nothing to run. Tell users beforehand.

**Check:** the `rds-memory-low` alarm (now at 800 MB) is OK, and `describe-db-instances`
shows `MultiAZ: true`.

## 9. Clean-up

- **Old website directory:** delete `/home/ubuntu/prime-website` from step 4's predecessor once the
  website has run a few days from `/srv/prime-website`.
- **Old export copies:** the copies left in `prime-tracker-documents-…/migration/` expire on their own
  within a day of step 3 (lifecycle rule). Nothing to delete by hand.
- **Instance role permissions:** remove the instance role's `WebsiteMedia` statements in `iam.tf` (the
  website now has its own role) and apply.

## Parked: Render, Firebase, Supabase

- `supabase/migrations/00000000000015_retire_supabase_auth_policies.sql` — drops the
  Supabase-Auth admin policies. Apply with the Supabase SQL editor when Render work
  resumes; it changes nothing the Render API does.
- Rotate `JWT_ACCESS_SECRET` on Render — the value in the public repo's history is the
  one in use there.
