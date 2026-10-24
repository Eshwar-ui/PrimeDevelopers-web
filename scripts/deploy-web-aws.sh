#!/usr/bin/env bash
# Deploy apps/web/dist to the AWS website bucket and purge CloudFront.
#
#   aws sso login --profile prime-client
#   scripts/deploy-web-aws.sh
#
# Builds in Vite's `aws` mode itself: the API is this site's own /api (CloudFront
# routes it to the website API on the tracker's EC2 host), and media is its own
# /media. A `pnpm run build:web` bundle points at Render and Supabase instead.
#
# media/ in the bucket holds uploads (scripts/aws/03-copy-content.sh and the API's
# STORAGE_DRIVER=s3), not build output. Both syncs below leave it alone.
#
# The bucket and distribution come from prime-tracker-main/infra/terraform/website.tf
# (enable_website = true). Cache-Control mirrors firebase.json: content-hashed
# assets, the Draco decoder and fonts are immutable; everything else — the HTML
# above all — revalidates on every navigation and keeps a 10-minute edge copy.
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

aws cloudfront create-invalidation --profile "$PROFILE" \
  --distribution-id "$DISTRIBUTION" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "Deployed to https://dtw8rs0oq8bpp.cloudfront.net"
