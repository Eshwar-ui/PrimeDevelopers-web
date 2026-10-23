#!/usr/bin/env bash
# Copy the website's public content and its files from Supabase to AWS.
#
#   rows  : content, properties, news   Supabase -> RDS prime_website
#   files : public Storage objects       -> s3://<website bucket>/media/<bucket>/<path>
#   URLs  : <supabase>/storage/v1/object/public/... -> <site>/media/...
#
# Public content only. Admin accounts and enquiries (website_admin_users,
# website_leads) are deliberately not touched here — they hold password hashes
# and personal details, and moving them is a separate, deliberate step. Files are
# fetched through their public URLs, so no Storage key is used.
#
# Re-runnable: run it to fill the preview, and again at cutover. Supabase is only
# read; on RDS the three tables are replaced in one transaction.
source "$(dirname "$0")/lib.sh"

SUPA_DB="$(grep -m1 '^DIRECT_URL=' "$ROOT/apps/api/.env" | cut -d= -f2- | tr -d '"')"
SUPA_PUBLIC="https://nrtqntqutquapydsnjbm.supabase.co/storage/v1/object/public"
[[ "$SUPA_DB" == *nrtqntqutquapydsnjbm* ]] || { echo "apps/api/.env is not the production Supabase project" >&2; exit 1; }

DATA="$STAGE/content"
MEDIA="$STAGE/media"
rm -rf "$DATA" && mkdir -p "$DATA" "$MEDIA"
trap 'rm -rf "$DATA" "$STAGE/website-content.tgz"' EXIT

TABLES=(content properties news)
for t in "${TABLES[@]}"; do
  psql "$SUPA_DB" -X -q -v ON_ERROR_STOP=1 \
    -c "\\copy (select * from public.$t) to '$DATA/$t.csv' with (format csv, header)"
  echo "exported $t"
done

# Public buckets only: what a visitor can already download.
psql "$SUPA_DB" -X -A -t -F $'\t' -c \
  "select o.bucket_id, o.name, coalesce(o.metadata->>'mimetype', 'application/octet-stream')
     from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where b.public order by 1, 2" >"$STAGE/objects.tsv"
echo "public storage objects: $(wc -l <"$STAGE/objects.tsv")"

fetched=0
while IFS=$'\t' read -r bucket name mime; do
  [ -n "$name" ] || continue
  dest="$MEDIA/$bucket/$name"
  [ -s "$dest" ] && continue
  mkdir -p "$(dirname "$dest")"
  enc=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$name")
  curl -sf "$SUPA_PUBLIC/$bucket/$enc" -o "$dest" || { echo "failed: $bucket/$name" >&2; rm -f "$dest"; exit 1; }
  fetched=$((fetched + 1))
done <"$STAGE/objects.tsv"
echo "downloaded $fetched new files"

# One sync per file type, so each object keeps the type Supabase recorded rather
# than a guess from the extension. Paths hold random ids and are never reused.
cut -f2- "$STAGE/objects.tsv" | awk -F'\t' '{n=split($1,p,"."); print tolower(p[n]) "\t" $2}' | sort -u |
  while IFS=$'\t' read -r ext mime; do
    aws s3 sync "$MEDIA" "s3://$WEBSITE_BUCKET/media" --only-show-errors \
      --exclude "*" --include "*.$ext" --include "*.$(echo "$ext" | tr a-z A-Z)" \
      --content-type "$mime" --cache-control "public, max-age=31536000, immutable"
    echo "uploaded *.$ext as $mime"
  done

COPYFILE_DISABLE=1 tar --no-xattrs -czf "$STAGE/website-content.tgz" -C "$DATA" .
aws s3 cp "$STAGE/website-content.tgz" "s3://$STAGE_BUCKET/migration/website-content.tgz" --quiet --sse AES256

ssm_script "website: load public content into RDS" <<REMOTE
#!/bin/bash
set -euo pipefail
WORK=\$(mktemp -d)
trap 'rm -rf "\$WORK"' EXIT
aws s3 cp s3://$STAGE_BUCKET/migration/website-content.tgz "\$WORK/c.tgz" --region $AWS_REGION --quiet
tar -xzf "\$WORK/c.tgz" -C "\$WORK" 2>/dev/null
DB_URL=\$(grep -m1 '^DIRECT_URL=' /home/ubuntu/prime-website/apps/api/.env | cut -d= -f2-)
OLD1="$SUPA_PUBLIC/"
OLD2="https://nrtqntqutquapydsnjbm.supabase.co/storage/v1/render/image/public/"
NEW="$SITE/media/"
{
  echo "begin;"
  # Attributions point at properties; they are rebuilt by the leads step, not here.
  echo "truncate website_lead_unit_attributions, website_tracker_syncs, news, properties, content;"
  for t in content properties news; do
    echo "\\\\copy public.\$t (\$(head -1 "\$WORK/\$t.csv")) from '\$WORK/\$t.csv' with (format csv, header)"
  done
  # A rewrite is not an edit: keep each row's updated_at as Supabase had it.
  echo "alter table content disable trigger user; alter table properties disable trigger user; alter table news disable trigger user;"
  for old in "\$OLD1" "\$OLD2"; do
    echo "update content set data = replace(data::text, '\$old', '\$NEW')::jsonb where data::text like '%\$old%';"
    echo "update properties set image = replace(image, '\$old', '\$NEW'), gallery = replace(gallery::text, '\$old', '\$NEW')::jsonb, detail = replace(detail::text, '\$old', '\$NEW')::jsonb;"
    echo "update news set cover_image = replace(cover_image, '\$old', '\$NEW'), body = replace(body, '\$old', '\$NEW');"
  done
  echo "alter table content enable trigger user; alter table properties enable trigger user; alter table news enable trigger user;"
  echo "commit;"
} >"\$WORK/load.sql"
psql "\$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "\$WORK/load.sql"
psql "\$DB_URL" -X -A -t -F ' ' <<'SQL'
select 'content', count(*) from content union all
select 'properties', count(*) from properties union all
select 'news', count(*) from news union all
select 'rows still naming supabase.co',
  (select count(*) from content where data::text like '%supabase.co%')
  + (select count(*) from properties where coalesce(image,'') || gallery::text || detail::text like '%supabase.co%')
  + (select count(*) from news where coalesce(cover_image,'') || body like '%supabase.co%');
SQL
REMOTE
aws s3 rm "s3://$STAGE_BUCKET/migration/website-content.tgz" --quiet
echo "export removed from S3 and from this machine"
