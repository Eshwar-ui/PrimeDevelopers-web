# Creating the Render service

Everything here needs a Render account, which is why it isn't automated. It
takes about ten minutes. When the service is live, send me its URL and I'll
build the frontend against it and deploy to Firebase.

The configuration in [`render.yaml`](../render.yaml) has been verified: the
exact build command, start command, and env-var set were run locally against
the production database, with the environment stripped to only what Render
supplies. The service booted, reported the database reachable in 76ms, allowed
the Firebase origin through CORS, and served Swagger nowhere.

## 1. Create the Blueprint

Render dashboard → **New → Blueprint** → pick this repository → branch `main`.
Render reads `render.yaml` and proposes one service, `prime-developers-api`.

> Already done — the service exists and tracks `main`. This section is here for
> rebuilding it from scratch.

## 2. Fill in the five secrets

Render prompts for every var marked `sync: false`. Values come from the
Supabase dashboard for project `nrtqntqutquapydsnjbm`.

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Settings → Database → **Connection pooling**. The `pooler.supabase.com` host. Used for every request. |
| `DIRECT_URL` | Settings → Database → **Session pooler** (port 5432), *not* "Direct connection". The `db.<ref>.supabase.co` host resolves to IPv6 only and Render's egress is IPv4, so a direct URL here fails to connect. Schema work only. |
| `JWT_ACCESS_SECRET` | Generate: `openssl rand -hex 64`. Not from Supabase. |
| `SUPABASE_URL` | `https://nrtqntqutquapydsnjbm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role`. **Server only** — never give this a `VITE_` prefix. |

> **Rotate first.** The database password and service-role key were pasted into
> a chat transcript on 30 Jul 2026. Reset both in Supabase before entering them
> here, and the pasted values become worthless.

Everything else — `NODE_VERSION`, `NODE_ENV`, expiries, `FRONTEND_URL`,
`CORS_ORIGINS` — is already set in `render.yaml` and needs no input.

## 3. Deploy and check

First build takes a few minutes (pnpm install, `prisma generate`, `nest build`).
When it reports live:

```bash
curl https://prime-developers-api.onrender.com/api/health/ready
```

Expect `{"status":"ok",...,"checks":{"database":{"ok":true,...}}}`. A
`"degraded"` status with a database error means `DATABASE_URL` is wrong — the
most common cause is using the direct connection where the pooler belongs.

Then run the full 40-check suite against it by editing `B=` at the top of
[`apps/api/test/smoke.sh`](../apps/api/test/smoke.sh) to the Render URL. It
creates a couple of throwaway properties and leads, so prefer running it before
the site is publicly announced, and delete the `smoke-plaza-*` and `draft-prop-*`
rows afterwards.

## 4. Send me the URL

I'll set `VITE_API_BASE_URL`, build, and `firebase deploy --only hosting`.

## Notes

- **`plan: starter`, not free.** Free services sleep after 15 minutes and
  cold-start in ~50s. The public site fetches its content on mount, so the first
  visitor after a quiet spell would wait that out on a blank page. Roughly
  $7/month is the real cost of putting a marketing site behind an API.
- **`autoDeploy: true`** — every push to the tracked branch redeploys. Turn it
  off if you'd rather deploy deliberately.
- **No migration runner in the build.** The schema is owned by
  `supabase/migrations/*.sql` and applied by hand. Migrations 1–10 are already
  applied to production as of 30 Jul 2026.
