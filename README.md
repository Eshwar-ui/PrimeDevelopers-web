# Prime Developers

pnpm monorepo: `apps/web` (React + Vite site and admin) and `apps/api` (NestJS + Prisma on Postgres: AWS RDS in production, Docker locally).

## Local setup

Requires Node >= 20 and pnpm >= 8.

```bash
pnpm install
```

### Option A — web only (no secrets needed)

`apps/web/.env.development` is committed and proxies `/api` to the deployed API, so the site loads real data with nothing to configure:

```bash
pnpm --filter @prime-developers/web dev   # http://localhost:5173
```

The dev server is pinned to port 5173. If it says the port is in use, stop whatever holds it — the proxy depends on it.

This is **live data**: changes made in the admin are real. To override anything personally, create `apps/web/.env.development.local` (gitignored).

### Option B — run the API locally

Needs Docker. The API runs against a local Postgres 15 (`docker-compose.yml`, port 5433), never production.

```bash
cp apps/api/.env.example apps/api/.env   # then set JWT_ACCESS_SECRET: openssl rand -hex 64
pnpm db:up                               # start Postgres and apply the Prisma migrations
pnpm db:seed                             # optional: copy the live CMS content (needs: aws sso login --profile prime-client)
node apps/api/scripts/create-admin.mjs   # a local admin login
```

`pnpm db:seed` copies content, properties, news and sync history. It never copies leads (real people's details) or admin logins. Image URLs keep pointing at the live site, so pictures load. Uploads made locally go to `apps/api/.media/`, which the API serves at `http://localhost:3001/media`.

Then point the web app at your API by putting this in `apps/web/.env.development.local`:

```bash
DEV_API_TARGET=http://localhost:3001
```

```bash
pnpm --filter @prime-developers/api dev
pnpm --filter @prime-developers/web dev
```

If the API exits at startup it names the missing variables. `pnpm db:down` stops the database; its data stays in a Docker volume.

### Checks (CI)

Every pull request to `main`, and every push to it, runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml). None of it needs secrets or a database, and it deploys nothing. To run the same checks before you push:

```bash
pnpm --filter @prime-developers/web test
pnpm --filter @prime-developers/web lint
VITE_API_BASE_URL=https://dtw8rs0oq8bpp.cloudfront.net pnpm --filter @prime-developers/web build
pnpm --filter @prime-developers/api exec prisma generate
pnpm --filter @prime-developers/api test
pnpm --filter @prime-developers/api exec tsc --noEmit
```

### Troubleshooting

| Symptom | Cause |
|---|---|
| "Could not reach the server" | Nothing answered `/api`: wrong port, API not running, or `DEV_API_TARGET` unreachable. |
| `GSAP target ... not found` | Follow-on of the above — no data, so nothing rendered. |
| CORS errors | The browser is calling the API directly. Use `VITE_API_BASE_URL=http://localhost:5173` so requests go through the proxy. |
