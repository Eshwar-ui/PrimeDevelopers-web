# Deployment Plan — Frontend on Firebase, Backend on Render

**Written:** 30 Jul 2026 · branch `chore/monorepo-restructure`

## Status at a glance

| Phase | State |
|---|---|
| 0 · Prerequisites | ✅ credentials received 30 Jul |
| 1 · pnpm monorepo | ✅ |
| 2 · API scaffold | ✅ schema verified against the live DB; `news` conflict **resolved** |
| 3 · API modules | ✅ all six, **uploads now verified** against production storage |
| 4 · Frontend cutover | ✅ **complete** — Supabase is gone from the browser |
| 5 · Render deploy | ✅ **live** — `prime-developers-api.onrender.com`, on the **free** plan |
| 6 · Ship frontend | ✅ **live** — the full cutover is deployed |
| 7 · Lock down access | ⛔ not started — now safe to do, see below |

Admin login is **`akhil@gmail.com`**. The previous `admin@prime.com` account was
removed when it was replaced, so there is exactly one admin.

> ### ⚠️ Upgrade Render to `starter`
> The homepage now fetches its content from the API, and the API is on Render's
> **free** plan. Free instances sleep after 15 minutes idle, so the first
> visitor after a quiet spell waits out a ~50 second cold start on a loading
> spinner — on the homepage, not just a form.
>
> This was deployed at the client's explicit instruction with that tradeoff
> stated. Add a card to the Render account and switch `prime-developers-api` to
> **starter** (~$7/mo) to remove it. No redeploy is needed afterwards.

### Live as of 30 Jul 2026

- **API** — `https://prime-developers-api.onrender.com`, Singapore, branch
  `chore/monorepo-restructure`, autoDeploy on. Verified in production: health,
  DB reachable (195ms Singapore→Mumbai), 9 properties and 1 news post serving,
  admin routes 401 to anonymous, Swagger absent, real admin login, refresh
  rotation invalidating the old token, CORS allowing only the Firebase origins.
- **Site** — `https://theprime-construction.web.app`. A real lead submitted
  through the live contact form reached Supabase via the API, and was then
  deleted through the admin endpoint (also verifying that). The 3D floor plan
  mounts and renders, units colour-coded by status.

> **⚠️ The API is on Render's free plan.** Adding the `starter` plan needs a card
> on the Render account, and the API returned *"Payment information is
> required"*. Free services sleep after 15 minutes idle and cold-start in
> ~50 seconds.
>
> Today the blast radius is small — only the contact form calls the API, so a
> stale visitor may wait on submit. **This becomes unacceptable the moment
> Phase 4's remaining cutover lands**, because `ContentContext` will fetch the
> homepage's content from the API and every cold visitor would face a blank page
> for the better part of a minute. Upgrade to starter before that ships.

### Applied to production on 30 Jul 2026

Migrations **8, 9 and 10**, after a CSV backup of all five CMS tables:

- **8** — `website_admin_users` + `website_admin_refresh_tokens`, RLS on, no policies.
- **9** — `property_id` on the attribution table is now `NOT NULL`, and the
  record is corrected: this database is **not** shared.
- **10** — revokes the grants Supabase's default privileges silently handed
  `anon`/`authenticated` on the two new auth tables. Migration 8 *intended* them
  ungranted; Supabase's `ALTER DEFAULT PRIVILEGES` overrode that. RLS was still
  denying access, so nothing was exposed, but password hashes and live session
  tokens shouldn't rest on a single control.

Admin account seeded as `admin@prime.com`. **The password contains the email's
local part**, which makes it guessable from the login address alone — change it
by re-running `prisma/seed-admin.ts` with a stronger `ADMIN_PASSWORD`.

**Everything else was already seeded.** All 12 content sections, 9 properties, 1
news post, and a 3D model on `pow-lewisville-phase-i` building 0 — the `.glb`
serves at HTTP 200 with 9 of its 10 units mesh-matched (`unit-410` has no mesh
and degrades to the 2D plan, exactly as `reconcile()` intends). The only gap is
2D hotspot coordinates: every unit has `x: null, y: null`, so the pins need
placing by hand in the admin.

### A bug this turn's verification caught

`/api/health` and `/api/health/ready` both returned **401**. `HealthController`
predates the global JWT guard and was silently captured when Phase 3 made that
guard global. Render polls `healthCheckPath` unauthenticated, so **the deploy
would have restart-looped**, presenting as a broken build rather than a missing
decorator. Fixed in `c012525`; the smoke suite now asserts 200 on both.

### Two corrections from inspecting the live database (30 Jul 2026)

**1. `news` uses `excerpt` and `cover_image`.** The frontend was right and
migration 6 was wrong — its `create table if not exists news` was a no-op
against the table migration 5 had already renamed into place, so the earlier
column names survived. Fixed in `e0ee37f`. Nothing in production was broken;
the API had been modelled on a DDL that never took effect.

**2. This database is not shared.** Migrations 6 and 7 both say it is. It
isn't. The `public` schema holds exactly five tables, all this website's —
`content`, `properties`, `news`, `website_leads`,
`website_lead_unit_attributions` — and every other schema present (`auth`,
`storage`, `realtime`, `vault`, `graphql`, `extensions`) is a Supabase
built-in. The construction-management application lives in a **different
Supabase project**.

This makes **Phase 7 much simpler than planned**: tightening grants and RLS on
these tables cannot affect another application, because there isn't one here.
The `website_` prefix is now just a name, and not worth renaming given the live
data behind it. It also means the "one database for both products" goal is
entirely ahead of us, not partly done — the two projects are separate.

**Live data as of 30 Jul:** 12 content sections, 9 properties, 1 news post, 0
leads. Backed up to CSV before any write.

### Blocked on a permission, not a credential

Applying migrations 8 and 9 to production, and loading production data into the
local scratch DB, were both **refused by the sandbox's permission classifier** —
correctly, since one writes schema to a live database and the other runs a
`truncate`. These need to be run by hand; see Phase 5 step 4.

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

## Phase 2 — Scaffold the API ✅ *(done — `7bbe12b`)*

`apps/api` on NestJS 10 + Prisma 5, matching `prime-tracker-main`'s versions.
`main.ts`, `PrismaService` and the health controller were lifted from there
verbatim, so the two services stay mergeable.

**The plan's `prisma db pull` step was abandoned, and the schema hand-written
instead.** Prisma 5 cannot restrict introspection to a subset of tables, and the
database is shared — a `db pull` would pull the construction-management
application's entire schema into `schema.prisma`. The five CMS models are
transcribed from migrations 6 and 7 instead, with the diff-against-live
procedure documented at the top of the file.

**Verified** against a scratch Postgres (`prime_developers_cms_scratch` on the
local PG14 — Docker was down, so the Supabase local stack wasn't available):
schema pushes cleanly, all five tables materialise, the service boots,
`/api/health/ready` reports the DB reachable, CORS rejects an unlisted origin,
and helmet headers are present. `pnpm run build` from the root builds both apps
— the same path Render will take.

### ⚠️ Open: the `news` column conflict

Migration 6 declares `news.summary` and `news.image`. The frontend reads and
writes `excerpt` and `cover_image` throughout — 15 references, zero to
`summary`. Both cannot be true.

If production matches the migration, **saving a news post is already broken in
production**: `NewsEditPage` spreads the whole form into `.update()`, so
Postgres would reject the unknown `excerpt` column. The likely history is that
migration 6's `create table if not exists news` was a no-op against a table
migration 5 had already renamed into place — but that is a guess, and the
schema currently follows the migration rather than the frontend.

**Settle this against the live database before building the news module.**
One query does it:

```sql
select column_name from information_schema.columns where table_name = 'news';
```

## Phase 3 — API modules ✅ *(done — `5953b4f`, except uploads)*

Built: `auth`, `content`, `properties`, `news`, `leads`, and — since `d78f39f`
— `uploads`.

**`uploads` is written but its storage write is unverified.** The auth
boundary, every validation path, and folder sanitising (traversal stripped,
leading slashes removed, pure-traversal rejected) are all covered by the smoke
suite. What is *not* exercised is the single `supabase.storage.upload()` call,
because that needs the service-role key. Treat the first real upload as a test.

Admin surfaces live under `admin/*` in their own controllers rather than as
decorated handlers on the public ones. That keeps the authentication boundary
visible in the URL and makes it impossible for a `:slug` route to shadow an
admin path.

**Verified end to end** — 34 checks in [`apps/api/test/smoke.sh`](../apps/api/test/smoke.sh),
run against a scratch Postgres: public reads, anonymous rejection on every
admin route, login failure modes, validation rejecting unknown fields, drafts
404ing publicly while visible to admins, refresh rotation invalidating the old
token, logout revoking, and login rate-limiting at 5/min. Confirmed separately
that a stale `propertyId` rolls the whole lead back rather than orphaning it.

Run it against a live API with:

```bash
bash apps/api/test/smoke.sh
```

### What changed from the plan

- **Auth uses opaque refresh tokens, not a second JWT.** They're stored as
  SHA-256 hashes, so the database row is the source of truth for validity and
  there's no second signing secret to manage. `JWT_REFRESH_SECRET` is therefore
  not a thing — `.env.example` was corrected.
- **The JWT guard is global**, with routes opting out via `@Public()`, so a new
  admin route that forgets to declare its auth fails closed rather than open.
- **`news` was built against the migration's column names** (`summary`/`image`),
  with the conflict isolated to the Prisma model and the DTO. If the live
  database turns out to use the frontend's names, the fix is those two files
  and nothing else — the services never name those fields individually.

### Original module table

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

## Phase 4 — Frontend cutover ⚠️ *(part-done — `8415afd`)*

**Done:** [`lib/api.js`](../apps/web/src/lib/api.js) and the contact form's lead
submission. Verified through the running UI — CORS preflight passes, 201
returned, both rows written with unit and building labels, fields cleared,
success state shown, no console errors. It also fixed a latent bug: the old
handler called `e.currentTarget.reset()` after two awaits, by which point React
has nulled `currentTarget`.

### ✅ Completed — `2401ba9`

`lib/supabase.js` is deleted and `@supabase/supabase-js` is out of the web app.
**The browser now holds no Supabase credential**; the anon key is not in the
bundle. Image and model URLs still point at the public buckets, but those are
plain URLs needing no key.

That is what makes **Phase 7 safe to do**: nothing in the browser depends on
anon access any more, so revoking it can't break the site.

Verified against the production database through the real UI — public site
loads, login, session surviving a reload via refresh-token restore, a draft
created and edited with the save reaching the database, the draft visible to
the admin but 404 to the public, an image uploaded through the API to Supabase
Storage and rendered back, and logout clearing the token. All test artifacts
removed; production is back to 9 published properties.

Two bugs surfaced while wiring it up: the lead status allow-list was missing
`read` (what the mark-read toggle writes — that button would have 400'd), and
`NewsEditPage` sent `publishedAt: ''` when the date was cleared, failing
ISO-8601 validation.

### Why it couldn't be done piecemeal

The plan assumed the frontend could be migrated file by file. It can't, and the
reason is worth recording because it also sets the order of everything left.

**`ContentContext` serves both the public site and the admin CMS.** Its
`supabase.from('properties').select('*')` returns different rows depending on
who's asking — RLS gives anonymous visitors published rows only, and
authenticated admins everything. Point it at the public API and the admin list
silently loses its drafts, so unpublished properties become uneditable. Point it
at the admin API and it needs a JWT, which means auth must already be cut over.

**Cutting auth over breaks uploads.** The storage policies are
`bucket_id = 'images' and auth.role() = 'authenticated'`. Drop Supabase Auth and
nobody is `authenticated` any more, so image and `.glb` uploads fail — and the
fix (routing uploads through the API) needs the service-role key, which is also
what Phase 3's uploads module is waiting on.

So the remainder — `ContentContext`, all six admin pages, `AuthContext`,
`RequireAuth`, and the storage helpers in `lib/supabase.js` — has to land as one
change, together with the API's uploads module and a storage-policy migration.
Anything less leaves the client's CMS half-broken.

**Unblocked by:** the Supabase service-role key in `apps/api/.env`.

**Note for Phase 6:** the contact form now depends on the API, so the frontend
must not be deployed to Firebase before the Render service is live.

### Original plan for this phase

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

## Phase 5 — Deploy the API to Render ⚠️ *(config done — `d78f39f`; deploy is yours to run)*

[`render.yaml`](../render.yaml) is written and committed. Creating the service
needs your Render account, so the remaining steps are:

1. Render dashboard → **New → Blueprint**, point it at this repo. It reads
   `render.yaml` and creates `prime-developers-api`.
2. Fill the five `sync: false` secrets when prompted: `DATABASE_URL`,
   `DIRECT_URL`, `JWT_ACCESS_SECRET` (`openssl rand -hex 64`), `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. **Check the region.** It's set to `singapore`; if the Supabase project lives
   elsewhere, change it — every request makes a database round trip and a
   cross-region hop taxes all of them.
4. **Apply migrations 8 and 9**, then seed an admin. Both are additive/tightening
   and were verified safe against the live database (the attribution table is
   empty, so the NOT NULL is instant); a CSV backup of all five CMS tables was
   taken first. Run from the repo root with `DIRECT_URL` set to the direct
   (5432) connection string:
   ```bash
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/00000000000008_website_admin_auth.sql -f supabase/migrations/00000000000009_attribution_property_required.sql
   ```
   ```bash
   cd apps/api && ADMIN_EMAIL=you@primedevelopers.com ADMIN_PASSWORD='at-least-12-chars' pnpm exec ts-node prisma/seed-admin.ts
   ```
   Note `DATABASE_URL` for Render should be the **pooler** (port 6543) with
   `?pgbouncer=true&connection_limit=1`; only `DIRECT_URL` uses 5432. The
   credential supplied so far is the direct one.
5. Verify: `curl https://prime-developers-api.onrender.com/api/health/ready`
   should report the database reachable. Then run the smoke suite against it by
   editing `B=` at the top of `apps/api/test/smoke.sh`.

Two departures from prime-tracker's version, both deliberate:

- **No `prisma migrate deploy` in the build.** This project has no Prisma
  migration history — the schema is owned by `supabase/migrations/*.sql` — and
  the database is shared, so a migration runner let loose on it could touch
  tables that aren't ours.
- **`plan: starter`, not `free`.** See the cost note under Decisions.

### Original render.yaml sketch

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
