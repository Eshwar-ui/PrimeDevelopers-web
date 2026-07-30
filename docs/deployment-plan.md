# Deployment Plan — Frontend on Firebase, Backend on Render

**Written:** 30 Jul 2026 · **Phases 0–1 complete** (branch
`chore/monorepo-restructure`), Phase 2 next

## Context

Prime Developers' site is a Vite + React 19 SPA that talks to Supabase directly
from the browser with the anon key. There is no backend tier. Every write the
admin CMS performs is a `supabase.from(...)` call from client JavaScript, and the
only thing standing between a visitor and the `properties` table is a row-level
security policy that reads `auth.role() = 'authenticated'` — meaning *any*
authenticated Supabase user can write *every* table.

We're introducing the API tier the original SOW specified: **NestJS + Prisma v5
over the existing Supabase Postgres, exposing REST under `/api/*`, deployed to
Render.** The SPA stays on Firebase Hosting. Supabase remains the database,
storage, and (for now) nothing else — the API sits in front of it.

The second goal shapes every structural decision here: this API is eventually
**merging into `prime-tracker-main`'s `apps/api`** so both products run one
server and one database. So we mirror that repo's layout, framework versions,
and conventions now, and the merge later becomes a *move*, not a rewrite.

### What's actually true today (verified, some of it surprising)

| | Current state |
|---|---|
| Frontend | Vite 8 / React 19 SPA → Firebase Hosting, project **`theprime-construction`** |
| Deploy | Manual `firebase deploy`. No CI, no `.github/`, no Dockerfile, no `render.yaml` |
| Prod database | Supabase project **`knghxhtfkbswzhphhigy`** — found only by grepping `dist/`; it is in no `.env` file in the repo |
| Local dev | Local Supabase stack (`127.0.0.1:55321`), currently not running |
| Auth | Supabase Auth — [`AuthContext.jsx`](../apps/web/src/context/AuthContext.jsx), gated by [`RequireAuth.jsx`](../apps/web/src/admin/RequireAuth.jsx) |
| Tables | `content`, `properties`, `news`, `website_leads`, `website_lead_unit_attributions` — units live as a **jsonb blob** on `properties.detail`, but lead→unit attribution is already relational |
| Storage | Buckets `images` and `models` (public read, 8 MB, glb-only) |

**The production database is shared with another application.** Migration 6
states it plainly: the CMS was applied to "a shared Supabase project that
already has a construction-mgmt schema", and website tables carry a `website_`
prefix wherever names collided — `leads` was already taken, so contact
submissions go to `website_leads`. Migration 7 reinforces it, deliberately
avoiding `GRANT ... ON ALL TABLES IN SCHEMA public` because that "would silently
change that application's access model too".

This is the single most important fact for everything downstream, and it cuts
both ways. It means **the "one database for both products" goal is already
partly real** — but it also means Phase 7's RLS lockdown is operating on a
database another live application depends on, so every grant change needs to be
scoped to the five `website_`/CMS tables and nothing else.

> **Worth confirming before Phase 2:** is `knghxhtfkbswzhphhigy` the same
> database prime-tracker uses? Its `render.yaml` names a *different* project
> (`dxkqrwxixjyzxhtxdkht`). If they are already the same DB, the merge is far
> closer than assumed; if not, there are two construction-management schemas in
> play and that needs untangling before any consolidation.

> The Supabase MCP connected to this session is authed to a different account
> (it lists only `maega_marketplace_core`). It cannot reach
> `knghxhtfkbswzhphhigy`, so connection strings and the service-role key must be
> collected from the Supabase dashboard by hand.

**Prod Supabase credentials exist nowhere except whoever last ran `vite build`**
— the deployed bundle is the only record of the project ref. Collecting and
storing them is the one Phase 0 item still outstanding.

---

## Target architecture

```
Browser
  ├─ static assets ──────────────→ Firebase Hosting (project: prime-developers)
  ├─ /api/*  (JSON) ─────────────→ Render Web Service  ─┐
  └─ images + .glb (direct URL) ─→ Supabase Storage      │ Prisma
                                                          ↓
                                   Supabase Postgres (knghxhtfkbswzhphhigy)
```

Repo becomes a pnpm workspace matching `prime-tracker-main`:

```
apps/web/     ← the existing SPA, moved wholesale
apps/api/     ← new NestJS 10 + Prisma 5
render.yaml   ← API service definition
firebase.json ← public: apps/web/dist
```

**Prisma introspects the live schema (`prisma db pull`) rather than defining
it.** The tables already exist with real client data in them; Prisma adopts
them. No data migration, no downtime, and the schema stays a faithful mirror.

---

## Phase 0 — Prerequisites ✅ *(mostly done)*

1. ~~**Commit the working tree.**~~ Done — `e3d8e2a`, 56 files.
2. ~~**Resolve the package manager.**~~ Done — `package-lock.json` removed,
   `pnpm-lock.yaml` committed.
3. **Collect prod credentials** — *still outstanding, and blocking Phase 2.*
   From the Supabase dashboard for project
   `knghxhtfkbswzhphhigy` — Settings → Database, and Settings → API:
   - `DATABASE_URL` — pooler, port **6543**, with `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` — direct, port **5432** (migrations only)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never in a `VITE_` var)
   - Note the project's **region** so Render can be provisioned to match.

   Store these in a password manager. They are the credentials the project
   currently has no durable record of.

## Phase 1 — Restructure into a pnpm monorepo ✅ *(done — `933e845`)*

SPA moved to `apps/web/` (package `@prime-developers/web`); root now carries
`pnpm-workspace.yaml` and a workspace `package.json` with
`dev`/`build:web`/`deploy:web`, mirroring `prime-tracker-main`.
`firebase.json` publishes `apps/web/dist`.

Two deviations from what was planned:

- **`tsconfig.base.json` deferred to Phase 2.** The web app is plain JS and
  nothing would consume it yet.
- **Seed scripts stayed at the root** with their own `@supabase/supabase-js`
  dependency, since the `package.json` they resolved against moved into
  `apps/web`.

**Checkpoint passed:** build output is byte-identical to the pre-move baseline
(same chunk hashes), lint is clean of new findings, and the dev server renders
the site with no console errors. `firebase deploy` has *not* been run — the
first deploy from the new layout should be a deliberate, watched one.

## Phase 2 — Scaffold the API

`apps/api` with NestJS 10 + Prisma 5, pinned to `prime-tracker-main`'s versions.
Copy rather than reinvent:

- `src/main.ts` — global prefix `/api`, `helmet()`, CORS from `CORS_ORIGINS`,
  `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, Swagger in
  non-prod. Mirror [`prime-tracker-main/apps/api/src/main.ts`](../../prime-tracker-main/apps/api/src/main.ts).
- `src/prisma/prisma.service.ts` and `common/health/health.controller.ts` — lift as-is.

Then `prisma db pull` against `DIRECT_URL` to generate `schema.prisma` from the
live database, and hand-tidy the model names to PascalCase with `@@map`.

## Phase 3 — API modules

One module per resource, following prime-tracker's
`*.controller.ts` / `*.service.ts` / `*.module.ts` shape:

| Module | Endpoints | Notes |
|---|---|---|
| `content` | `GET /api/content`, `PUT /api/content/:section` | jsonb passthrough |
| `properties` | `GET /api/properties`, `GET /api/properties/:slug`, admin CRUD | public GET filters `published = true` |
| `news` | same shape as properties | |
| `leads` | `POST /api/leads` (public), admin list/update/delete | table is `website_leads`; writes the `website_lead_unit_attributions` row in the same transaction — today the client fires two independent inserts and only logs a failed attribution. Rate-limit the public POST |
| `auth` | `POST /api/auth/login`, `/refresh`, `/logout` | |
| `uploads` | `POST /api/uploads/image`, `/model` | service-role key, server-side |

**Auth changes mechanism.** Supabase Auth is replaced by Nest JWT — bcrypt +
`passport-jwt`, access/refresh pair — because that is what prime-tracker uses,
and matching it now is the difference between the eventual merge being a file
move and being an auth migration. It means an `admin_users` table and a seeded
admin. Practically this is a small change: there is one admin account.

**Uploads move server-side.** Browser POSTs the file to the API; the API writes
to Supabase Storage with the service-role key. Buckets stay public-read, so
every existing `<img>` and `.glb` URL keeps working untouched.

**Validation is the real win here.** Lead submissions currently reach the
database with whatever shape the client sends. class-validator DTOs make that a
400.

## Phase 4 — Frontend cutover

Add a thin `apps/web/src/lib/api.js` (fetch wrapper, `VITE_API_BASE_URL`, bearer
token, error normalisation) and replace Supabase table calls. All paths below are
under `apps/web/`. The surface is small — the whole app makes **14
`supabase.from()` calls across 8 files**:

- [`src/context/ContentContext.jsx`](../apps/web/src/context/ContentContext.jsx) — the three public reads, in one fan-out
- [`src/pages/ContactPage.jsx`](../apps/web/src/pages/ContactPage.jsx) — lead insert + unit attribution
- `src/admin/{LeadsPage,PropertiesListPage,PropertyEditPage,NewsListPage,NewsEditPage,ContentSectionPage}.jsx`
- [`src/context/AuthContext.jsx`](../apps/web/src/context/AuthContext.jsx) — swap `signInWithPassword` for the JWT endpoints
- [`src/lib/supabase.js`](../apps/web/src/lib/supabase.js) — keep `publicImageUrl` (pure URL construction, no auth); point `uploadImage`/`uploadModel` at the API

The 3D and floor-plan components need no changes — they read from context and
props, never Supabase. The PRD's instruction to funnel unit access through
`src/lib/units.js` pays off exactly here.

## Phase 5 — Deploy the API to Render

`render.yaml` at the repo root, adapted from prime-tracker's:

```yaml
services:
  - type: web
    name: prime-developers-api
    runtime: node
    plan: starter          # see "Decisions" — not free
    region: singapore      # match the Supabase project's region
    rootDir: .             # repo root, so the pnpm workspace resolves
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter api build
    startCommand: node apps/api/dist/main
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - { key: NODE_ENV, value: production }
      - { key: DATABASE_URL, sync: false }
      - { key: DIRECT_URL, sync: false }
      - { key: JWT_ACCESS_SECRET, sync: false }
      - { key: JWT_REFRESH_SECRET, sync: false }
      - { key: SUPABASE_URL, sync: false }
      - { key: SUPABASE_SERVICE_ROLE_KEY, sync: false }
      - { key: CORS_ORIGINS, value: https://theprime-construction.web.app }
```

Secrets go in the Render dashboard (`sync: false`), never in the committed file.
Note this omits prime-tracker's Redis service — nothing here needs BullMQ yet.

## Phase 6 — Ship the frontend

Set `VITE_API_BASE_URL=https://prime-developers-api.onrender.com` at build time,
then `pnpm build:web && firebase deploy --only hosting`.

Optionally add `.github/workflows/deploy.yml` — the repo has no CI today, and
manual deploys are how the prod Supabase ref came to exist only inside a built
bundle.

## Phase 7 — Close the direct-write hole

Only after Phase 6 is verified, tighten access so the anon key can no longer
write. Revoke the `authenticated` grants added in migration 7 and drop the
`auth.role() = 'authenticated'` write policies, leaving service-role-only
access. The API connects as a privileged role and is unaffected; the browser
loses a capability it no longer uses.

**Scope every statement to the five CMS tables by name** — `content`,
`properties`, `news`, `website_leads`, `website_lead_unit_attributions`. The
database is shared with the construction-management application, and a
schema-wide `REVOKE` would take its access with it. Migration 7 sets the
precedent and explains why; follow it exactly.

**This is the phase that makes the whole exercise worth doing** — until it lands,
the API is an additional path to the data rather than the only one.

---

## Verification

Each phase has a checkpoint; don't proceed past a red one.

1. **Phase 1** — `pnpm build` then `firebase deploy`; site behaves identically.
2. **Phase 3** — `pnpm --filter api dev` against the *local* Supabase stack.
   Exercise every endpoint via Swagger at `localhost:3001/api/docs`. Never point
   local development at the prod database.
3. **Phase 4** — full manual pass with the browser preview: homepage content
   renders, property detail + floor plan + 3D viewer load, contact form creates a
   lead, admin login works, each admin page saves, image and `.glb` upload
   succeed.
4. **Phase 5** — `curl https://prime-developers-api.onrender.com/api/health`;
   confirm CORS rejects an unlisted origin.
5. **Phase 7** — with the anon key, attempt `insert` into `properties` and
   confirm it is rejected; confirm the public site still reads fine.

**Take a database backup before Phase 7**, and ideally before Phase 3 — this is
live client data, shared with another running application, with no staging copy.

Also worth a smoke test after Phase 5 and again after Phase 7: confirm the
construction-management application still works. It shares this database, and
nothing in this plan is supposed to touch it.

---

## Decisions worth your attention

**Render's free plan is wrong for this site.** Free services sleep after 15
minutes idle and cold-start in ~50 seconds. Since `ContentContext` fetches the
homepage's content on mount, the first visitor after a quiet period would stare
at an empty page for the better part of a minute. Starter (~$7/mo) is the real
cost of this architecture. The alternative — leaving public GETs on Supabase
direct and routing only admin writes through the API — keeps the site instant
and free, but it means two data paths and undercuts Phase 7. **Recommend
Starter.** Free is fine for a staging service.

**Scope is genuinely large.** This is a new authentication system, a new API
tier, and a frontend rewrite of every data call. Phases 0–2 are mechanical;
Phase 3 onward is real engineering. Sequenced as above, each phase ends with a
working deployable site, so this can be paused between phases without leaving
things half-migrated.

**The merge into prime-tracker stays deliberately out of scope** — but it may be
nearer than it looked. Everything here is shaped to make it cheap: same
framework versions, same module layout, same auth mechanism, same `render.yaml`
conventions. And the databases may already be one, given migration 6's shared
project (see the open question above).

What still has to be reconciled is the *schema*, not the server: prime-tracker
has relational `Building`/`Unit`/`Lead` tables, while this site keeps units as a
jsonb blob on `properties.detail` and its leads in a parallel `website_leads`
table. Collapsing those is the real work of merging, and it deserves its own
plan rather than being smuggled into this one.

**SSR is still unsolved.** Firebase Hosting serves static files, so the floor
plan PRD's no-JS/SEO criterion (§17) remains unmet regardless of this work. An
API tier doesn't fix it; only server rendering does. Flagging it so it isn't
assumed closed.
