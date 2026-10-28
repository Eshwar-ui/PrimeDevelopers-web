# Implementation Plan: Local dev setup that works on a fresh clone

## Overview
A fresh clone shows "Could not reach the server" because commit 1512b6d untracked
apps/web/.env.development and `.gitignore` ignores every `.env.*`. The browser
then calls an API that is not running. Fix: commit a secret-free web dev config
that proxies to the deployed API, document setup, and make the API fail loudly
when its own `.env` is missing.

## Architecture Decisions
- apps/web/.env.development is committed again (public URLs only). Default
  DEV_API_TARGET is the deployed API, so no secrets are needed to work on the UI.
- Vite dev runs on a fixed port (5173, strictPort) so VITE_API_BASE_URL (same
  origin, proxied) can never drift to a fallback port.
- apps/web/.env.production stays untracked: production deploys go through
  scripts/deploy-web-aws.sh, which passes its own variables.
- API secrets stay out of git. Local API needs its own dev database (not prod).

## Task List
- [ ] Task 1: Un-ignore + restore apps/web/.env.development; pin dev port
- [ ] Task 2: Fix apps/web/.env.example and apps/api/.env.example
- [ ] Task 3: README "Local setup" section
- [ ] Task 4: API fails fast with a clear message when required env is missing

### Checkpoint
- [ ] `git check-ignore` shows .env.development tracked-able, apps/api/.env still ignored
- [ ] Vite dev with no personal env proxies /api to the deployed API
- [ ] API without DATABASE_URL exits with a readable message; API build passes

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidentally un-ignoring secrets | High | Negate one exact path only; verify with git check-ignore |
| Team writes to prod via deployed API | Med | README warns; dev DB recommended |

## Open Questions
- Separate Supabase dev project + key rotation need the owner (not done here).
