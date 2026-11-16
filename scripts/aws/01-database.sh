#!/usr/bin/env bash
# Secrets for the website API, and its own database on the tracker's RDS instance.
#
# One server, two databases: `prime_website`, owned by its own `prime_website` login,
# beside the tracker's. The website API never holds the tracker's credentials, so a
# website bug cannot reach sale prices, rents or investors. Safe to re-run: every
# step checks before it creates, and nothing here drops or alters the tracker's data.
source "$(dirname "$0")/lib.sh"

ensure_secret DB_PASSWORD 24
ensure_secret JWT_ACCESS_SECRET 64
ensure_secret TRACKER_SYNC_SECRET 32
# Sent by CloudFront on every request to the website API (website.tf) and required by
# nginx (02-deploy-api.sh), so the API answers CloudFront and nothing else.
ensure_secret ORIGIN_SECRET 32

ssm_script "website: create prime_website database" <<'REMOTE'
#!/bin/bash
set -euo pipefail
# The RDS master login is used here only to create the website's role and database,
# and never written anywhere else. It is MIGRATE_DATABASE_URL in SSM: since 27 Oct the
# tracker's own DATABASE_URL is its data-only login (prime_tracker_app), which cannot
# create either. Read from SSM rather than the tracker's .env, whose values are quoted.
MASTER=$(aws ssm get-parameter --name /prime-tracker/MIGRATE_DATABASE_URL --with-decryption \
  --region us-east-1 --query Parameter.Value --output text 2>/dev/null || true)
if [ -z "$MASTER" ] || [ "$MASTER" = REPLACE_ME ]; then
  MASTER=$(aws ssm get-parameter --name /prime-tracker/DATABASE_URL --with-decryption \
    --region us-east-1 --query Parameter.Value --output text)
fi
# Prisma's URL may carry ?schema=…&connection_limit=…, which psql rejects.
MASTER="${MASTER%%\?*}?sslmode=require"
# Every connection URL here carries a password, and psql's command line is readable
# by any user on the host through ps (security audit L7). pg() strips the password
# out of the URL (user and host are not secret) and hands it over in PGPASSWORD,
# percent-decoded, which ps does not show.
pg() {
  local url="$1"; shift
  local pw bare
  pw=$(printf '%s' "$url" | sed -nE 's#^[a-z]+://[^:/@]+:([^@]*)@.*#\1#p')
  bare=$(printf '%s' "$url" | sed -E 's#^([a-z]+://[^:/@]+):[^@]*@#\1@#')
  PGPASSWORD="$(printf '%b' "${pw//%/\\x}")" psql "$bare" "$@"
}
PGPASSWORD_WEB=$(aws ssm get-parameter --name /prime-tracker/website/DB_PASSWORD --with-decryption \
  --region us-east-1 --query Parameter.Value --output text)

has_role=$(pg "$MASTER" -XAtc "select 1 from pg_roles where rolname = 'prime_website'")
if [ -z "$has_role" ]; then
  # The password goes in through stdin, not -v (which is on the command line).
  # It is openssl rand -hex output (ensure_secret), so it needs no escaping; refuse
  # anything else rather than quote it wrong.
  [[ "$PGPASSWORD_WEB" =~ ^[A-Za-z0-9]+$ ]] || { echo "unexpected DB_PASSWORD format" >&2; exit 1; }
  printf "\\set pw '%s'\ncreate role prime_website login password :'pw';\n" "$PGPASSWORD_WEB" \
    | pg "$MASTER" -X -q -v ON_ERROR_STOP=1
  echo "role prime_website created"
else
  echo "role prime_website exists"
fi

has_db=$(pg "$MASTER" -XAtc "select 1 from pg_database where datname = 'prime_website'")
if [ -z "$has_db" ]; then
  # RDS's master is not a superuser: it must be a member of a role to create a
  # database owned by it.
  pg "$MASTER" -X -v ON_ERROR_STOP=1 \
    -c "grant prime_website to current_user" \
    -c "create database prime_website owner prime_website" \
    -c "revoke connect on database prime_website from public" \
    -c "grant connect on database prime_website to prime_website"
  echo "database prime_website created"
else
  echo "database prime_website exists"
fi

HOST=$(echo "$MASTER" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#')
pg "postgresql://prime_website:${PGPASSWORD_WEB}@${HOST}:5432/prime_website?sslmode=require" -XAtc \
  "select 'connected as ' || current_user || ' to ' || current_database() || ', postgres ' || current_setting('server_version')"
REMOTE
