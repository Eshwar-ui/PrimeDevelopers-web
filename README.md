# Prime Developers

pnpm monorepo: `apps/web` (React + Vite site and admin) and `apps/api` (NestJS + Prisma on Supabase Postgres).

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

1. `cp apps/api/.env.example apps/api/.env` and fill it in. Get the values from the project owner through the team password manager — never chat or git.
2. Use a **development** database, not production.
3. Start the API (http://localhost:3001) and point the web app at it by putting this in `apps/web/.env.development.local`:

```bash
DEV_API_TARGET=http://localhost:3001
```

```bash
pnpm --filter @prime-developers/api dev
pnpm --filter @prime-developers/web dev
```

If the API exits at startup it names the missing variables.

### Troubleshooting

| Symptom | Cause |
|---|---|
| "Could not reach the server" | Nothing answered `/api`: wrong port, API not running, or `DEV_API_TARGET` unreachable. |
| `GSAP target ... not found` | Follow-on of the above — no data, so nothing rendered. |
| CORS errors | The browser is calling the API directly. Use `VITE_API_BASE_URL=http://localhost:5173` so requests go through the proxy. |
