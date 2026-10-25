# Prime Developers on AWS — production plan

Written 24 Oct 2026. Covers both products: **Prime Tracker** (internal app) and the
**public website**. Goal set by Kalyan: a system that does not go down, loses no data,
and is monitored and secured properly. Cost is not the constraint. Where this plan
leaves something out, it says so and why.

## Where things stand

| Piece | Today | Why it is not good enough |
|---|---|---|
| Database | One RDS `db.t3.micro` (1 GB), single-AZ, shared by tracker + website | Already at its memory limit (alarm `prime-tracker-rds-memory-low` since 23 Oct). One AZ failure or any maintenance = both products down. |
| App server | One EC2 `t3.micro` (914 MB) running both APIs, nginx, Redis, the tracker SPA | Single point of failure. Every deploy restarts in place. Patching is by hand. |
| Tracker code | 9 scheduled jobs, socket.io notifications, task attachments on local disk, in-memory cache | All assume exactly one server, so a second one for redundancy is not possible yet. |
| TLS / domain | `3-232-150-154.nip.io` + Let's Encrypt; `theprimedeveloper.com` DNS lives outside this account and serves the 2023 site | No real domain for the tracker; certificate tied to one IP. |
| Website | Front end on CloudFront ✅, API + data on the EC2 box above | Inherits every weakness above. |
| Terraform state | A file on one laptop | Lose the laptop, lose the ability to manage production safely. |
| Email | SES not verified, sandboxed | Brochure/lead emails from AWS do not send. |
| Staging | None | Every change is tested on production. |
| Security | Basic IAM, SSM-only shell (good) | No WAF, GuardDuty, CloudTrail review, Security Hub. |
| Backups | RDS automated, 30 days, same region | No off-region copy, never restore-tested. |

What is already good and stays: Terraform for everything, SSM instead of SSH,
CloudWatch alarms + SMS/email (`monitoring.tf`), S3 versioning on media/documents,
OIDC deploys from GitHub (no long-lived keys), the website on CloudFront.

## Target architecture

```
                    Route 53: theprimedeveloper.com (zone in this account)
                                         │
             ┌───────────────────────────┼─────────────────────────────┐
             │                           │                             │
   theprimedeveloper.com/www      app.theprimedeveloper.com   media.theprimedeveloper.com
   CloudFront + WAF               CloudFront + WAF            CloudFront
   S3: website SPA                S3: tracker SPA             S3: uploads
             │ /api/*                    │ api.*
             └──────────────┬────────────┘
                     Application Load Balancer + WAF   (2 AZs, HTTPS, ACM)
                            │
          ECS Fargate (private subnets, 2 AZs, auto scaling)
          ├─ tracker-api   ×2+   (HTTP + socket.io)
          ├─ tracker-worker ×1   (the 9 scheduled jobs, website sync)
          └─ website-api   ×2+   (CMS API, image resizer)
                            │
          ├─ RDS Proxy ─ RDS PostgreSQL Multi-AZ  db.m7g.large (8 GB)
          │                databases: prime_tracker, prime_website
          ├─ ElastiCache (Valkey) Multi-AZ — socket.io fan-out, cache, rate limits
          └─ S3 (media, documents, website media) — versioned, replicated to us-west-2

  Around it: Secrets Manager · SES (verified domain, production) · CloudWatch +
  Synthetics · GuardDuty · Security Hub · CloudTrail · AWS Config · AWS Backup
  (cross-region) · ECR · GitHub Actions (OIDC) → staging → approval → production
```

Choices that are deliberate:

- **One database server, two databases, Multi-AZ, large enough.** Isolation by
  database and login is already in place; a bigger Multi-AZ instance fixes the memory
  problem permanently and makes failover ~60 s instead of an outage. RDS Proxy keeps
  connections pooled as tasks scale and shortens failover further. Splitting into two
  instances later is a config change, not a redesign.
- **`m7g` (non-burstable), not `t3`/`t4g`.** Burstable instances run out of CPU credits
  under sustained load; "perfect" means no credit cliff.
- **Fargate, not more EC2.** No servers to patch, every deploy is a fresh container,
  failed tasks are replaced automatically, rolling deploys with automatic rollback.
- **A separate worker for scheduled jobs.** Simplest correct answer to "two API copies
  would run every job twice" — no leader election to get wrong.

Not included, on purpose: **Shield Advanced** (~$3,000/month; Shield Standard + WAF
covers this risk profile) and **multi-region active-active** (doubles everything; the
cross-region backups below give a tested recovery path instead). Both can be added.

## Code changes before more than one copy can run

| # | Change | Repo |
|---|---|---|
| C1 | Scheduled jobs only where `RUN_SCHEDULED_JOBS=true` (the worker); API tasks skip them | tracker |
| C2 | socket.io Redis adapter (`@socket.io/redis-adapter`) so a notification reaches every user whichever task they are on | tracker |
| C3 | Task attachments through the existing S3 storage driver instead of `multer.diskStorage` (`tasks.controller.ts`) — today they live on the EC2 disk | tracker |
| C4 | `CacheService` on Redis (its own comment already describes the swap) | tracker |
| C5 | Rate limiting (`@nestjs/throttler`) stored in Redis, so limits hold across tasks | both |
| C6 | Graceful shutdown (`enableShutdownHooks`, drain on SIGTERM) for zero-downtime deploys | both |
| C7 | Dockerfiles (multi-stage, Node 22, non-root) and ECR | both |
| C8 | Secrets from Secrets Manager instead of `.env` files written by scripts | both |

Each is tested on staging first.

## Phases

### Phase 0 — stabilise now (this week)

| Step | Downtime | Notes |
|---|---|---|
| RDS → `db.m7g.large`, Multi-AZ, gp3 with autoscaling, Performance Insights, Enhanced Monitoring (15 s) | 5–10 min, in the Monday 08:00–09:00 UTC window (13:30–14:30 IST) | Fixes the memory alarm for good. Multi-AZ conversion itself is online; the class change restarts once. After this, maintenance is a ~60 s failover. |
| Terraform state → S3 (versioned, encrypted) + DynamoDB lock | None | Highest-value safety fix; today one laptop holds it. |
| EC2 → `t3.medium` until Fargate replaces it | ~2 min | Headroom for both APIs meanwhile. |
| Re-base alarms for the new sizes | None | Memory, connections, CPU thresholds per instance class. |
| SES: verify the domain (DKIM, SPF, DMARC), request production access | None | Needs DNS access (Phase 1, decision D2). |

### Phase 1 — domain, certificates, staging (week 1–2)

- Find where `theprimedeveloper.com` DNS lives today (Route 53 in another AWS
  account), export **every** record — MX, SPF, DKIM, Google/Microsoft verification —
  and recreate them in a zone here **before** moving nameservers, so staff email
  never breaks. Then `enable_dns = true`: wildcard certificate, `app.`, `api.`,
  `media.`.
- Staging: same Terraform, separate AWS account in the organisation (recommended) or
  separate VPC; smaller sizes; `staging.theprimedeveloper.com`.

### Phase 2 — containers, load balancer, Redis (weeks 2–4)

- Network: private subnets for tasks, NAT gateway per AZ, VPC endpoints (S3, ECR,
  Secrets Manager, CloudWatch Logs, SSM).
- ECS cluster; services `tracker-api`, `tracker-worker`, `website-api`; auto scaling on
  CPU, memory and request count; ALB health checks on `/api/health/ready`.
- ElastiCache Valkey (primary + replica, automatic failover); RDS Proxy.
- Code changes C1–C8, proven on staging.

### Phase 3 — cut over (week 5)

- Tracker: DNS to the ALB and CloudFront; keep the EC2 box one week as fallback, then
  terminate it.
- Website go-live (client's date, decision D3): final run of `scripts/aws/03` and `04`,
  tracker → website sync switched on, SES live, apex + `www` on CloudFront, **301
  redirects from the 2023 site's URLs** so search rankings carry over.
- Two weeks later: final Supabase export archived to S3, then Render, Firebase Hosting
  and Supabase shut down — which also retires the leaked Supabase keys.

### Phase 4 — security, recovery, operations (weeks 5–6, partly in parallel)

- **WAF** on both CloudFront distributions and the ALB: AWS core rule set, known-bad
  inputs, IP reputation, rate rules on `/api/auth/login` and `/api/leads`.
- **GuardDuty, Security Hub** (AWS Foundational Best Practices), **CloudTrail** (all
  regions, log validation), **AWS Config**, IAM Access Analyzer.
- **Backups:** AWS Backup — RDS daily (35 days) + monthly (1 year), copied to
  `us-west-2`; S3 cross-region replication for uploads. **Restore drill** into staging
  every quarter; targets RPO 5 minutes (point-in-time recovery), RTO 1 hour.
- **Monitoring:** dashboards per service; alarms on ALB 5xx, unhealthy targets, p95
  latency, task CPU/memory, RDS/Proxy, Redis; **CloudWatch Synthetics** canaries
  (homepage, a property page, tracker login, API health) every 5 minutes; alerts by
  email, SMS and Slack.
- **Deploys:** GitHub Actions → tests → image → staging → smoke tests → manual approval
  → production rolling deploy with automatic rollback. Terraform: plan on every pull
  request, apply after approval.
- **Runbooks:** deploy, rollback, database restore, region outage, incident response.

## Monthly cost (estimates, us-east-1, on-demand)

| Item | Production |
|---|---|
| RDS `db.m7g.large` Multi-AZ + 100 GB gp3 + monitoring | ~$275 |
| RDS Proxy | ~$22 |
| ECS Fargate (tracker-api ×2, worker ×1, website-api ×2) | ~$125 |
| ElastiCache Valkey, 2 nodes | ~$47 |
| Load balancer | ~$25 |
| NAT gateways ×2 + VPC endpoints | ~$140 |
| CloudFront ×3 + WAF | ~$45 |
| CloudWatch (logs, alarms, dashboards, Synthetics) | ~$60 |
| GuardDuty, Security Hub, Config, CloudTrail | ~$40 |
| Backups cross-region, S3 replication, Route 53, Secrets Manager, SES, ECR | ~$25 |
| **Production total** | **~$800** |
| Staging (single-AZ, one task each) | ~$150–200 |
| **All in** | **~$950–1,000 / month** |

Today's AWS bill is well under $100/month. These are estimates for planning; confirm in
the AWS Pricing Calculator before approval. Nothing here is cost-cut; a 1–3 year
Savings Plan later would lower the same setup by roughly a third without changing it.

## Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Approve ~$950–1,000/month | — |
| D2 | Who controls `theprimedeveloper.com` DNS today, and does staff email use it (MX)? | Needed before any DNS step. |
| D3 | Website go-live date (replaces the 2023 site) | After Phase 2 is stable. |
| D4 | Staging in a separate AWS account or the same one | Separate account. |
| D5 | Monday 08:00–09:00 UTC window for the database upgrade | Yes, this Monday. |
| D6 | Slack channel for alerts | Optional. |

## How the work gets applied

Code, Terraform and scripts are prepared as pull requests with a saved `terraform plan`.
Production applies need a human: the coding assistant's safety rules block it from
applying production infrastructure or running scripts on production servers, so each
production step is run by Kalyan (or approved per command).
