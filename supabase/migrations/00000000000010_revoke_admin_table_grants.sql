-- Revokes the grants Supabase hands out automatically on new public tables.
--
-- Migration 8 says the auth tables are "deliberately NOT granted to anon or
-- authenticated". That was the intent, but it isn't what happened: Supabase
-- ships an `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
-- authenticated` for the public schema, so both roles were granted
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on
-- website_admin_users and website_admin_refresh_tokens the moment they were
-- created. Verified after applying migration 8 on 30 Jul 2026.
--
-- Nothing was actually exposed: RLS is enabled on both tables with zero
-- policies, which denies every role subject to RLS — `set role anon; select
-- count(*) from website_admin_users` returns 0, not a row count. But these
-- tables hold bcrypt password hashes and live session tokens, and "one control
-- happens to be holding" is not the posture to leave them in. If RLS were ever
-- disabled during debugging, or a permissive policy added for an unrelated
-- reason, the grant would be waiting.
--
-- After this, reaching these tables requires the service role or the table
-- owner — which is exactly who the API connects as.

revoke all on public.website_admin_users            from anon, authenticated;
revoke all on public.website_admin_refresh_tokens   from anon, authenticated;

-- Future tables in this schema inherit the same default. This stops the next
-- sensitive table from repeating the problem, without touching the grants the
-- five CMS tables legitimately rely on (migration 7).
alter default privileges in schema public revoke all on tables from anon, authenticated;
