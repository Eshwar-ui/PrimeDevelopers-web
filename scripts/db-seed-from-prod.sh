#!/usr/bin/env bash
# Copy the live CMS content into the local Docker database (docker-compose.yml).
#
#   aws sso login --profile prime-client
#   pnpm db:up && pnpm db:seed
#
# Read-only on production: pg_dump runs on the EC2 host (RDS is not reachable from a
# laptop), the dump travels through the private staging bucket and is purged from it,
# then it replaces the local tables. Copied: content, properties, news and the tracker
# sync history. NOT copied, on purpose:
#   - website_leads and their unit attributions: real people's names, emails and
#     phone numbers, with no testing value the CMS content does not already give;
#   - website_admin_users and refresh tokens: password hashes are credentials.
#     Create a local login with apps/api/scripts/create-admin.mjs instead.
# Images and models keep their production URLs, so they load from the live site.
source "$(dirname "$0")/aws/lib.sh"

TABLES=(content properties news website_tracker_syncs)
KEY="deploy/website-dev-seed-$$-${RANDOM}.sql"
OUT="$STAGE/dev-seed.sql"
trap 'rm -f "$OUT"' EXIT

# Only ever the compose database: a typo here must not be able to point the
# TRUNCATE below at anything else.
docker compose -f "$ROOT/docker-compose.yml" exec -T db pg_isready -U prime -d prime_website >/dev/null || {
  echo "The local database is not running. Start it with: pnpm db:up" >&2
  exit 1
}

{
  echo '#!/bin/bash'
  echo 'set -euo pipefail'
  echo "TABLES='${TABLES[*]}'; KEY='$KEY'; BUCKET='$STAGE_BUCKET'; R='$AWS_REGION'"
  cat <<'REMOTE'
TRACKER_URL=$(aws ssm get-parameter --name /prime-tracker/DATABASE_URL --with-decryption --region $R --query Parameter.Value --output text)
DB_HOST=$(echo "$TRACKER_URL" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#'); unset TRACKER_URL
export PGPASSWORD="$(aws ssm get-parameter --name /prime-tracker/website/DB_PASSWORD --with-decryption --region $R --query Parameter.Value --output text)"
args=(); for t in $TABLES; do args+=(-t "public.$t"); done
pg_dump "postgresql://prime_website@${DB_HOST}:5432/prime_website?sslmode=require" \
  --data-only --no-owner --no-privileges --disable-triggers "${args[@]}" \
  | aws s3 cp - "s3://$BUCKET/$KEY" --region $R --quiet --sse AES256
echo "dumped: $TABLES ($(pg_dump --version))"
REMOTE
} | ssm_script "website: dump CMS content for local dev"

aws s3 cp "s3://$STAGE_BUCKET/$KEY" "$OUT" --quiet
purge_s3_key "$KEY"

{
  echo "BEGIN;"
  echo "TRUNCATE $(IFS=,; echo "${TABLES[*]}") CASCADE;"
  cat "$OUT"
  echo "COMMIT;"
} | docker compose -f "$ROOT/docker-compose.yml" exec -T db psql -U prime -d prime_website -X -q -v ON_ERROR_STOP=1 >/dev/null

for t in "${TABLES[@]}"; do
  printf '%-24s %s rows\n' "$t" "$(docker compose -f "$ROOT/docker-compose.yml" exec -T db psql -U prime -d prime_website -XAtc "select count(*) from $t")"
done
echo "Local database seeded. Create a local admin: node apps/api/scripts/create-admin.mjs"
