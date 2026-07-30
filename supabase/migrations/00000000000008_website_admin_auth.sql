-- Admin authentication for the website CMS, replacing Supabase Auth.
--
-- Why not keep Supabase Auth: the API tier is being merged into
-- prime-tracker's NestJS service, which authenticates with its own JWT +
-- bcrypt. Matching that mechanism now makes the merge a file move rather than
-- an auth migration. Nothing else in this database uses Supabase Auth for the
-- website.
--
-- Both tables follow the `website_` prefix convention that migrations 6 and 7
-- established. That convention rests on a premise that turned out to be false
-- — see migration 9 — but the prefix is kept anyway for consistency with the
-- four tables that already carry it and hold live data.
--
-- Deliberately NOT granted to `anon` or `authenticated`, and RLS is enabled
-- with no policies at all. Nothing reachable from a browser should ever read
-- these rows. The API connects as the table owner, which bypasses RLS.

create extension if not exists "pgcrypto";

-- ── website_admin_users ──────────────────────────────────────────────────
create table if not exists public.website_admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.website_admin_users enable row level security;

-- ── website_admin_refresh_tokens ─────────────────────────────────────────
-- Refresh tokens are stored as SHA-256 hashes, never in the clear: a leaked
-- database dump should not hand out live sessions. Storing them at all (rather
-- than using a stateless refresh JWT) is what makes logout actually revoke
-- something instead of merely asking the client to forget.
create table if not exists public.website_admin_refresh_tokens (
  token_hash text primary key,
  user_id    uuid not null references public.website_admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.website_admin_refresh_tokens enable row level security;

create index if not exists website_admin_refresh_tokens_user_idx
  on public.website_admin_refresh_tokens (user_id);

-- Lets the periodic cleanup of expired/revoked rows use an index scan.
create index if not exists website_admin_refresh_tokens_expires_idx
  on public.website_admin_refresh_tokens (expires_at);

create trigger website_admin_users_set_updated_at before update on public.website_admin_users
  for each row execute function public.set_updated_at();
