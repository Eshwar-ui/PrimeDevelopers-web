# Uptime monitoring

The API is the whole site. Every page fetches its content from
`prime-developers-api.onrender.com` on mount, so when the API stops answering
the public site renders empty — no error page, no 500, just blank sections.
Nothing else notices. That is what this monitoring is for.

Set up in UptimeRobot. The free plan (50 monitors, 5-minute checks, email
alerts) covers everything below.

## The one thing that is easy to get wrong

`/api/health/ready` **returns HTTP 200 even when the database is unreachable.**
It reports the failure in the body:

```json
{ "status": "degraded", "checks": { "database": { "ok": false, "error": "..." } } }
```

That is deliberate — see the comment in
[`render.yaml`](../render.yaml), which points Render's own health check at the
liveness probe instead, so a Supabase outage doesn't make Render tear down and
redeploy an instance that was never the problem.

The consequence for monitoring: a plain **HTTP(s)** monitor on `/ready` sees
200 and stays green through a total database outage. It must be a **Keyword**
monitor. This is the single reason the readiness monitor below is configured
the way it is.

## Monitor 1 — API liveness

Catches: the process being down, Render suspending the service, a failed
deploy, a crash loop.

| Setting | Value |
|---|---|
| Type | **Keyword** |
| Friendly name | `Prime API — liveness` |
| URL | `https://prime-developers-api.onrender.com/api/health` |
| Keyword | `"status":"ok"` |
| Keyword type | **Does not exist** (alert when the keyword is *absent*) |
| Interval | 5 minutes |
| Timeout | 30 seconds |

Keyword rather than plain HTTP even here. Observed failure mode on 10 Sep 2026:
Render's edge held the connection open for **420 seconds** and then returned a
**503 with an empty body** — on every path, not just the health ones. A keyword
check fails that correctly, and so would a status-code check; the keyword also
covers the case where the edge serves a branded error page instead, which a
`2xx`-only check can miss.

> **30-second timeout, not the 5-second default.** While the service is on
> Render's free plan it spins down after 15 minutes idle and cold-starts in
> roughly 50 seconds, which would flap a short timeout every quiet night. See
> the note on the free plan below.
>
> The timeout is also what turns a hang into an alert. In the 10 Sep outage the
> edge did not refuse the connection — it accepted it and held it for seven
> minutes. Without a timeout well under the check interval, a monitor sits
> waiting instead of reporting.

## Monitor 2 — API readiness (database)

Catches: Supabase down, connection pool exhausted, a rotated password that was
never updated in Render, the pooler URL swapped for the direct one.

| Setting | Value |
|---|---|
| Type | **Keyword** |
| Friendly name | `Prime API — database` |
| URL | `https://prime-developers-api.onrender.com/api/health/ready` |
| Keyword | `"status":"ok"` |
| Keyword type | **Does not exist** |
| Interval | 5 minutes |
| Timeout | 30 seconds |

Match on `"status":"ok"` and not on `degraded`: an empty body, an edge error
page, and a timeout all fail this check too, which is what you want. Watching
for `degraded` would only catch the one failure the endpoint is well enough to
describe.

Keep both monitors. Liveness alone misses a database outage; readiness alone
tells you something is wrong but not whether the process is up, and that is the
difference between "wait for Supabase" and "go look at Render".

## Monitor 3 — Public site (optional)

| Setting | Value |
|---|---|
| Type | **Keyword** |
| Friendly name | `Prime Developers — site` |
| URL | `https://theprimedeveloper.web.app/` |
| Keyword | `Prime Developers` |
| Keyword type | **Does not exist** |
| Interval | 5 minutes |

Firebase Hosting rarely goes down, and when it does it isn't ours to fix. The
value here is different: the site can be up and serving a shell while the API
is dead, and having both on one status page makes that obvious at a glance.

The keyword is verified present in the served `index.html` (it is the `<title>`),
not only in the rendered page — a keyword that only appears after JavaScript
runs would fail every check.

Because this monitor requests the SPA shell, it will **not** catch empty
sections caused by a dead API. Monitors 1 and 2 are what cover that.

## Alert contacts

Attach the same contacts to all monitors. Email is enough to start; add a
second channel before anyone relies on this.

Set **"Send a notification when the monitor goes back up"** as well — an alert
that never resolves teaches everyone to ignore alerts.

Free-plan email alerts fire after a single failed check, so a slow cold start
can produce a short false alarm. If that becomes noise, the fix is the paid
plan's confirmation threshold, or the free plan's 30-second timeout above.

## What an alert means

| Firing | Likely cause | First move |
|---|---|---|
| Liveness only | Process down, deploy failed, service suspended | Render dashboard → Logs → last deploy |
| Readiness only | Database unreachable; process is fine | `curl .../api/health/ready` and read `checks.database.error`; then the Supabase status page |
| Both | Service is gone entirely | Render dashboard — liveness failing takes readiness with it |
| Site only | Firebase Hosting, or a bad deploy | `firebase hosting:channel:list`, roll back in the Firebase console |

Readiness firing while liveness stays green is the design working: the API is
alive and Render is correctly not restarting it, and the problem is on the
Supabase side.

## The free plan interacts with this

The service is on Render's **free** plan, though
[`render.yaml`](../render.yaml) specifies `starter` — the plan was changed in
the dashboard and the blueprint was never updated to match. Two consequences:

- **Spin-down.** Free services sleep after 15 minutes idle. A 5-minute monitor
  keeps the instance warm as a side effect, which is a real improvement for
  the first visitor of the day — but do not treat monitoring as the fix for
  the free plan. If the monitor is ever paused, cold starts come straight back.
- **Suspension.** Prolonged inactivity suspends a free service outright, and it
  does not come back on its own. That is a state monitor 1 detects and nothing
  else does.

Switching to `starter` (~$7/mo) removes both. No redeploy needed.

## Known gap

`/api/health/ready` returns the raw driver error string in `checks.database.error`
on a public, unauthenticated endpoint. A connection failure can put the database
host and username in that field for anyone who asks. The monitor doesn't make
this worse — the endpoint is already public — but it is worth fixing separately;
the diagnostic value it provides is the reason it hasn't been.
