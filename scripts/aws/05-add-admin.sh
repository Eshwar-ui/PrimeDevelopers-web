#!/usr/bin/env bash
# Add a CMS admin account on AWS, or set a new password on an existing one.
#
#   scripts/aws/05-add-admin.sh
#
# Asks for the email, an optional name and the password. The password is typed here
# with echo off and is never put on a command line or written to disk: it is hashed on
# this machine with the same bcrypt library the API checks it with, and only the hash
# leaves — the way 04-copy-admins.sh moves hashes: an owner-only file, through the
# private staging bucket encrypted, deleted from this machine, the server and S3 at the
# end.
#
# An email that already exists gets the new password (its id, and so its history, stays)
# and is signed out everywhere: its refresh tokens are revoked.
source "$(dirname "$0")/lib.sh"

# The CMS publishes to the whole site and reads every lead's contact details. Twelve
# characters keeps out the short passwords automated attacks try first.
MIN_LENGTH=12

read -r -p "Admin email: " EMAIL
EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[[ "$EMAIL" =~ ^[^@,\"]+@[^@,\"]+\.[^@,\"]+$ ]] || { echo "That is not an email address." >&2; exit 1; }
read -r -p "Name (optional): " NAME
read -r -s -p "Password: " PASSWORD; echo
read -r -s -p "Password again: " AGAIN; echo
[ "$PASSWORD" = "$AGAIN" ] || { echo "The two passwords differ — nothing changed." >&2; exit 1; }
unset AGAIN
[ "${#PASSWORD}" -ge "$MIN_LENGTH" ] || { echo "Use at least $MIN_LENGTH characters — nothing changed." >&2; exit 1; }
# bcrypt ignores everything past 72 bytes, so a longer password would only look stronger.
[ "$(printf '%s' "$PASSWORD" | wc -c)" -le 72 ] || { echo "Use at most 72 bytes — nothing changed." >&2; exit 1; }

# Through stdin, not the command line, so the password never shows in the process list.
HASH="$(printf '%s' "$PASSWORD" | (cd "$ROOT/apps/api" && node -e '
  let s = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(require("bcrypt").hashSync(s, 12)))
'))"
unset PASSWORD
[[ "$HASH" == \$2[aby]\$12\$* ]] || { echo "Hashing failed — is apps/api installed (pnpm install)?" >&2; exit 1; }

EXPORT="$STAGE/admin-add.csv"
KEY="migration/website-admin-add.csv"
umask 077
trap 'rm -f "$EXPORT"; purge_s3_key "$KEY" 2>/dev/null || true' EXIT
printf '%s,%s,"%s"\n' "$EMAIL" "$HASH" "$(printf '%s' "$NAME" | sed 's/"/""/g')" >"$EXPORT"
unset HASH
aws s3 cp "$EXPORT" "s3://$STAGE_BUCKET/$KEY" --quiet --sse AES256
rm -f "$EXPORT"

ssm_script "website: add or update a CMS admin" <<REMOTE
#!/bin/bash
set -euo pipefail
umask 077
WORK=\$(mktemp -d)
trap 'rm -rf "\$WORK"' EXIT
aws s3 cp s3://$STAGE_BUCKET/$KEY "\$WORK/admin.csv" --region $AWS_REGION --quiet

# The website's own login, built from SSM as 02-deploy-api.sh builds it.
TRACKER_URL=\$(aws ssm get-parameter --name /prime-tracker/DATABASE_URL --with-decryption --region $AWS_REGION --query Parameter.Value --output text)
HOST=\$(echo "\$TRACKER_URL" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#')
unset TRACKER_URL
[[ "\$HOST" =~ ^[A-Za-z0-9.-]+\$ ]] || { echo "could not read the RDS host from /prime-tracker/DATABASE_URL" >&2; exit 1; }
export PGPASSWORD=\$(aws ssm get-parameter --name $PARAMS/DB_PASSWORD --with-decryption --region $AWS_REGION --query Parameter.Value --output text)
DB="host=\$HOST port=5432 dbname=prime_website user=prime_website sslmode=require"

psql "\$DB" -X -q -v ON_ERROR_STOP=1 <<SQL
begin;
create temp table incoming (email text, password_hash text, name text) on commit drop;
\\copy incoming from '\$WORK/admin.csv' with (format csv)
insert into public.website_admin_users (email, password_hash, name)
select email, password_hash, nullif(name, '') from incoming
on conflict (email) do update
  set password_hash = excluded.password_hash,
      name = coalesce(excluded.name, website_admin_users.name);
-- A new password signs the account out everywhere.
update public.website_admin_refresh_tokens t set revoked_at = now()
  from public.website_admin_users u join incoming i on i.email = u.email
 where t.user_id = u.id and t.revoked_at is null;
commit;
SQL

echo "admin accounts on AWS now:"
psql "\$DB" -X -A -t -c "select '  ' || email || coalesce(' (' || name || ')', '') from public.website_admin_users order by created_at"
REMOTE

echo "Sign in at $SITE/admin/login as $EMAIL."
