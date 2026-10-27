#!/usr/bin/env bash
# Copy the website's admin accounts from Supabase to AWS, so the same email and
# password sign in to the CMS on AWS.
#
#   website_admin_users   Supabase -> RDS prime_website   (insert or update by id)
#
# Passwords are bcrypt hashes and portable as they are: nothing is reset and no
# password is ever seen. Sessions (website_admin_refresh_tokens) are not copied —
# AWS signs its tokens with a different secret, so everyone signs in once.
#
# Additive: an account that exists only on AWS is left alone. Re-run after adding
# or changing an admin in the old CMS. Supabase is only read. The export holds the
# hashes, so it is written owner-only, travels encrypted through the private
# staging bucket, and is deleted from this machine, the server and S3 at the end.
source "$(dirname "$0")/lib.sh"

SUPA_DB="$(grep -m1 '^DIRECT_URL=' "$ROOT/apps/api/.env" | cut -d= -f2- | tr -d '"')"
[[ "$SUPA_DB" == *nrtqntqutquapydsnjbm* ]] || { echo "apps/api/.env is not the production Supabase project" >&2; exit 1; }

EXPORT="$STAGE/admins.csv"
KEY="migration/website-admins.csv"
umask 077
trap 'rm -f "$EXPORT"; purge_s3_key "$KEY" 2>/dev/null || true' EXIT

psql "$SUPA_DB" -X -q -v ON_ERROR_STOP=1 -c "\\copy (
  select id, email, password_hash, name, created_at, updated_at
    from public.website_admin_users order by created_at
) to '$EXPORT' with (format csv, header)"
count=$(($(wc -l <"$EXPORT") - 1))
echo "exported $count admin account(s) from Supabase"
[ "$count" -gt 0 ] || { echo "nothing to copy" >&2; exit 1; }

aws s3 cp "$EXPORT" "s3://$STAGE_BUCKET/$KEY" --quiet --sse AES256
rm -f "$EXPORT"

ssm_script "website: copy admin accounts into RDS" <<REMOTE
#!/bin/bash
set -euo pipefail
umask 077
WORK=\$(mktemp -d)
trap 'rm -rf "\$WORK"' EXIT
aws s3 cp s3://$STAGE_BUCKET/$KEY "\$WORK/admins.csv" --region $AWS_REGION --quiet
# The website's own login, built from SSM as 02-deploy-api.sh builds it. It used to be
# read from /home/ubuntu/prime-website, the layout from before /srv/prime-website, which
# the runbook's clean-up step deletes.
TRACKER_URL=\$(aws ssm get-parameter --name /prime-tracker/DATABASE_URL --with-decryption --region $AWS_REGION --query Parameter.Value --output text)
HOST=\$(echo "\$TRACKER_URL" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#')
unset TRACKER_URL
[[ "\$HOST" =~ ^[A-Za-z0-9.-]+\$ ]] || { echo "could not read the RDS host from /prime-tracker/DATABASE_URL" >&2; exit 1; }
export PGPASSWORD=\$(aws ssm get-parameter --name $PARAMS/DB_PASSWORD --with-decryption --region $AWS_REGION --query Parameter.Value --output text)
DB_URL="host=\$HOST port=5432 dbname=prime_website user=prime_website sslmode=require"

psql "\$DB_URL" -X -q -v ON_ERROR_STOP=1 <<SQL
begin;
create temp table incoming (like public.website_admin_users) on commit drop;
\\copy incoming (id, email, password_hash, name, created_at, updated_at) from '\$WORK/admins.csv' with (format csv, header)

-- One email belonging to two different ids would fail on the unique index halfway
-- through; say which account it is instead, and change nothing.
do \\\$\\\$
declare clash text;
begin
  select string_agg(i.email, ', ') into clash
    from incoming i join public.website_admin_users u on lower(u.email) = lower(i.email) and u.id <> i.id;
  if clash is not null then
    raise exception 'already on AWS under a different id: %', clash;
  end if;
end
\\\$\\\$;

-- Keep updated_at as Supabase had it: copying an account is not editing it.
alter table public.website_admin_users disable trigger user;
insert into public.website_admin_users (id, email, password_hash, name, created_at, updated_at)
select id, email, password_hash, name, created_at, updated_at from incoming
on conflict (id) do update
  set email = excluded.email, password_hash = excluded.password_hash,
      name = excluded.name, updated_at = excluded.updated_at;
alter table public.website_admin_users enable trigger user;
commit;
SQL

echo "admin accounts on AWS now:"
psql "\$DB_URL" -X -A -t -c "select '  ' || email || coalesce(' (' || name || ')', '') from public.website_admin_users order by created_at"
REMOTE

echo "export removed from this machine; the S3 copy is removed on exit"
echo "Sign in at $SITE/admin/login with the same email and password as the current CMS."
