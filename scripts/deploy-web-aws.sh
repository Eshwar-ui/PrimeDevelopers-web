#!/usr/bin/env bash
# Deploy apps/web/dist to the AWS website bucket and purge CloudFront.
#
#   aws sso login --profile prime-client
#   scripts/deploy-web-aws.sh
#
# Builds in Vite's `aws` mode itself: the API is this site's own /api (CloudFront
# routes it to the website API on the tracker's EC2 host), and media is its own
# /media. This is the site's only deployment: Firebase Hosting was retired on
# 25 Oct 2026, and `pnpm run deploy:web` runs this script.
#
# media/ in the bucket holds uploads (scripts/aws/03-copy-content.sh and the API's
# STORAGE_DRIVER=s3), not build output. Both syncs below leave it alone.
#
# The bucket and distribution come from prime-tracker-main/infra/terraform/website.tf
# (enable_website = true). Cache-Control: content-hashed assets, the Draco decoder
# and fonts are immutable; everything else — the HTML above all — revalidates on
# every navigation (so a deploy shows at once) and keeps a 10-minute edge copy.
#
# Order matters: immutable files first, HTML last, so no visitor is ever served an
# index.html that names a bundle not yet uploaded.
set -euo pipefail

PROFILE="${AWS_PROFILE:-prime-client}"
ACCOUNT="056836825737"
BUCKET="s3://prime-tracker-website-${ACCOUNT}"
DISTRIBUTION="E25N0DCCIGFVRS"
DIST="$(cd "$(dirname "$0")/.." && pwd)/apps/web/dist"

# The default CLI credentials on this machine belong to the old test account. A
# deploy that lands there succeeds silently and changes nothing anyone can see.
actual="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
if [ "$actual" != "$ACCOUNT" ]; then
  echo "Profile $PROFILE is account $actual, not $ACCOUNT — refusing to deploy." >&2
  exit 1
fi

SITE="https://dtw8rs0oq8bpp.cloudfront.net"
# VITE_REFRESH_COOKIE: the API keeps the admin refresh token in an HttpOnly cookie
# on AWS (REFRESH_COOKIE=true in 02-deploy-api.sh) — the two must match.
VITE_API_BASE_URL="$SITE" VITE_MEDIA_BASE="$SITE/media" VITE_REFRESH_COOKIE=true \
  pnpm --filter @prime-developers/web exec vite build --mode aws

# Either of these in the bundle means it would talk to the old stack, not AWS.
if grep -rqE "localhost:(3001|5173|5174)|onrender\.com|nrtqntqutquapydsnjbm" "$DIST/assets"; then
  echo "The build still points at localhost, Render or Supabase — not deploying." >&2
  exit 1
fi

# robots.txt and sitemap.xml. The CloudFront host is a staging copy of the real
# domain, so seo-assets.mjs gives it a robots.txt that disallows everything and an
# empty sitemap; on theprimedeveloper.com it lists the published properties and
# posts. Both have extensions, so website_spa serves them as files.
node "$(dirname "$0")/seo-assets.mjs" --site "$SITE" --api "$SITE" --out "$DIST"

# Each route's <head> baked into its own <path>/index.html, so a shared link
# previews that page (docs/seo-setup.md). Writes dist/.prerendered-routes.json,
# the list route-store.mjs keeps CloudFront's route store in step with.
node "$(dirname "$0")/prerender.mjs" --site "$SITE" --api "$SITE" --out "$DIST"

# The site's CSP allows inline scripts by hash (website_inline_script_hashes in
# prime-tracker-main/infra/terraform/website.tf). Once the policy is enforced, a
# page whose inline script the header doesn't know loses that script: no theme
# before first paint, no content prefetch. So every HTML file this build would
# upload, the prerendered ones included, must use only hashes the live header
# already lists, or nothing is uploaded.
live_csp="$(curl -sI "$SITE/" | tr -d '\r' | grep -i '^content-security-policy' || true)"
if [ -z "$live_csp" ]; then
  echo "Could not read the live Content-Security-Policy from $SITE — not deploying." >&2
  exit 1
fi
missing=""
for hash in $(find "$DIST" -name '*.html' -exec node "$(dirname "$0")/csp-hashes.mjs" {} \; | sort -u); do
  case "$live_csp" in
    *"$hash"*) ;;
    *) missing="$missing $hash" ;;
  esac
done
if [ -n "$missing" ]; then
  echo "The live CSP lacks:$missing" >&2
  echo "Add each to website_inline_script_hashes in prime-tracker-main/infra/terraform/website.tf," >&2
  echo "apply, then deploy again. Nothing was uploaded." >&2
  exit 1
fi

# Drop store keys for pages this build no longer has, before the sync below
# deletes their files: a key naming a missing file would answer 403.
node "$(dirname "$0")/route-store.mjs" prune --dist "$DIST" --profile "$PROFILE"

aws s3 sync "$DIST" "$BUCKET" --profile "$PROFILE" --only-show-errors \
  --exclude "*" --include "assets/*" --include "draco/*" --include "fonts/*" \
  --cache-control "public, max-age=31536000, immutable"

# --delete prunes files a later build dropped. It never touches the immutable
# prefixes above, which are excluded here: a visitor midway through a session
# may still need the previous build's chunks.
aws s3 sync "$DIST" "$BUCKET" --profile "$PROFILE" --only-show-errors --delete \
  --exclude "assets/*" --exclude "draco/*" --exclude "fonts/*" --exclude "media/*" \
  --exclude "test-model.glb" --exclude ".*" --exclude "*/.*" \
  --cache-control "public, max-age=0, s-maxage=600"

# Now that every prerendered file is in the bucket, let CloudFront serve them.
node "$(dirname "$0")/route-store.mjs" add --dist "$DIST" --profile "$PROFILE"

aws cloudfront create-invalidation --profile "$PROFILE" \
  --distribution-id "$DISTRIBUTION" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "Deployed to https://dtw8rs0oq8bpp.cloudfront.net"
