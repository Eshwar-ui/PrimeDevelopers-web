# Deployment Plan — Frontend on Firebase, Backend on Render

**Status:** proposed, not started · **Written:** 30 Jul 2026

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
| Frontend | Vite 8 / React 19 SPA → Firebase Hosting, project `prime-developers` |
| Deploy | Manual `firebase deploy`. No CI, no `.github/`, no Dockerfile, no `render.yaml` |
| Prod database | Supabase project **`knghxhtfkbswzhphhigy`** — found only by grepping `dist/`; it is in no `.env` file in the repo |
| Local dev | Local Supabase stack (`127.0.0.1:55321`). Both `.env` and `.env.seed` point here |
| Auth | Supabase Auth — [`src/context/AuthContext.jsx`](src/context/AuthContext.jsx), gated by [`src/admin/RequireAuth.jsx`](src/admin/RequireAuth.jsx) |
| Tables | `content` (jsonb by section), `properties`, `news`, `leads` — units live as a **jsonb blob** on `properties.detail`, not relational rows |
| Storage | Buckets `images` and `models` (public read, 8 MB, glb-only) |
| Package manager | **Conflicted** — `package.json` declares pnpm 10.33, but a `package-lock.json` is committed |
| Working tree | ~1,300 lines of uncommitted 3D floor-plan work |

Two of these are blockers rather than notes. **Prod Supabase credentials exist
nowhere except whoever last ran `vite build`** — the deployed bundle is the only
record of the project ref. And the **package-manager conflict will break Render
builds**, which install from whichever lockfile they find.

> The Supabase MCP connected to this session is authed to a different account
> (it lists only `maega_marketplace_core`). It cannot manage
> `knghxhtfkbswzhphhigy`, so the connection strings and service-role key must be
> collected from the Supabase dashboard by hand.

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

## Phase 0 — Prerequisites (blocking, ~1 hour)

1. **Commit the working tree.** The 3D floor-plan work is uncommitted and every
   later phase moves these files. Commit before touching anything.
2. **Resolve the package manager.** Delete `package-lock.json`, commit
   `pnpm-lock.yaml`. Render and the monorepo both assume pnpm.
3. **Collect prod credentials** from the Supabase dashboard for project
   `knghxhtfkbswzhphhigy` — Settings → Database, and Settings → API:
   - `DATABASE_URL` — pooler, port **6543**, with `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` — direct, port **5432** (migrations only)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never in a `VITE_` var)
   - Note the project's **region** so Render can be provisioned to match.

   Store these in a password manager. They are the credentials the project
   currently has no durable record of.

## Phase 1 — Restructure into a pnpm monorepo

`git mv` the SPA into `apps/web/`; add `pnpm-workspace.yaml` (`apps/*`), a root
`package.json` with `dev`/`build`/`deploy:web` scripts, and `tsconfig.base.json`
— all copied from `prime-tracker-main` so the layouts are identical.

Update `firebase.json` → `"public": "apps/web/dist"`. `.firebaserc` is unchanged.

**Checkpoint:** `pnpm build && firebase deploy --only hosting` still ships the
current site. Nothing has changed functionally yet — verify before proceeding.

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
| `leads` | `POST /api/leads` (public), admin list/update/delete | rate-limit the public POST |
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
token, error normalisation) and replace Supabase table calls. **Only six files
touch tables** — the surface is small:

- [`src/context/ContentContext.jsx`](src/context/ContentContext.jsx) — the three public reads, all in one fan-out
- [`src/pages/ContactPage.jsx`](src/pages/ContactPage.jsx) — lead insert
- `src/admin/{LeadsPage,PropertiesListPage,PropertyEditPage,NewsListPage,NewsEditPage,ContentSectionPage}.jsx`
- [`src/context/AuthContext.jsx`](src/context/AuthContext.jsx) — swap `signInWithPassword` for the JWT endpoints
- [`src/lib/supabase.js`](src/lib/supabase.js) — keep `publicImageUrl` (pure URL construction, no auth); point `uploadImage`/`uploadModel` at the API

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
      - { key: CORS_ORIGINS, value: https://prime-developers.web.app }
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

Only after Phase 6 is verified, tighten Supabase RLS so the anon key can no
longer write. Replace the `auth.role() = 'authenticated'` write policies on
`content`, `properties`, `news`, and `leads` with service-role-only access. The
API connects as a privileged role and is unaffected; the browser loses a
capability it no longer uses.

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
live client data with no staging copy.

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

**The merge into prime-tracker stays deliberately out of scope.** Everything
here is shaped to make it cheap later — same framework versions, same module
layout, same auth mechanism, same `render.yaml` conventions. But the two
products model the same domain differently: prime-tracker has relational
`Building`/`Unit`/`Lead` tables, while this site keeps units as a jsonb blob on
`properties.detail`. Reconciling those two schemas is the actual work of
merging, and it deserves its own plan rather than being smuggled into this one.

**SSR is still unsolved.** Firebase Hosting serves static files, so the floor
plan PRD's no-JS/SEO criterion (§17) remains unmet regardless of this work. An
API tier doesn't fix it; only server rendering does. Flagging it so it isn't
assumed closed.
