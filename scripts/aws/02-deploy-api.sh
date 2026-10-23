#!/usr/bin/env bash
# Deploy the website API to the tracker's EC2 host, as PM2 process
# `prime-website-api` on 127.0.0.1:3002.
#
# Visitors reach it as <site>/api/... : CloudFront's /api/* behaviour (website.tf)
# forwards to https://<nip.io>/website-api/api/..., and nginx maps /website-api/
# to this process. Same-origin from the browser's side, so no CORS on AWS.
#
# Built here (TypeScript output is platform-neutral), installed there (bcrypt,
# sharp and Prisma's engine are native and must match Linux). The tracker on the
# same host is not restarted, and nginx is only reloaded after `nginx -t` passes,
# with the previous config restored if it does not.
source "$(dirname "$0")/lib.sh"

cd "$ROOT"
pnpm --filter @prime-developers/api run build
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$STAGE/website-api.tgz" \
  package.json pnpm-lock.yaml pnpm-workspace.yaml \
  apps/web/package.json \
  apps/api/package.json apps/api/prisma apps/api/dist
tar -tzf "$STAGE/website-api.tgz" >/dev/null
aws s3 cp "$STAGE/website-api.tgz" "s3://$STAGE_BUCKET/deploy/website-api.tgz" --quiet
echo "uploaded $(du -h "$STAGE/website-api.tgz" | cut -f1) artifact"

ssm_script "website: deploy API" "$(cat <<REMOTE
#!/bin/bash
set -euo pipefail
export HOME=/home/ubuntu NVM_DIR=/home/ubuntu/.nvm CI=true
source "\$NVM_DIR/nvm.sh" 2>/dev/null || true
export PATH=\$PATH:/home/ubuntu/.local/share/pnpm:/usr/local/bin
APP=/home/ubuntu/prime-website
param() { aws ssm get-parameter --name "$PARAMS/\$1" --with-decryption --region $AWS_REGION --query Parameter.Value --output text; }

mkdir -p "\$APP"
rm -rf "\$APP/apps/api/dist"
aws s3 cp s3://$STAGE_BUCKET/deploy/website-api.tgz /tmp/website-api.tgz --region $AWS_REGION --quiet
tar -xzf /tmp/website-api.tgz -C "\$APP" && rm -f /tmp/website-api.tgz
cd "\$APP"
pnpm install --frozen-lockfile --filter @prime-developers/api 2>&1 | tail -3

# Rewritten whole on every deploy, from SSM and the constants here — nothing set
# by hand on the box survives, which is what keeps this file honest.
MASTER=\$(grep -m1 '^DATABASE_URL=' /home/ubuntu/prime-tracker/apps/api/.env | cut -d= -f2- | tr -d '"')
DB_HOST=\$(echo "\$MASTER" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#')
DB_URL="postgresql://prime_website:\$(param DB_PASSWORD)@\${DB_HOST}:5432/prime_website?sslmode=require"
umask 077
cat > apps/api/.env <<ENV
NODE_ENV=production
PORT=3002
DATABASE_URL=\${DB_URL}&connection_limit=5
DIRECT_URL=\${DB_URL}
JWT_ACCESS_SECRET=\$(param JWT_ACCESS_SECRET)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
FRONTEND_URL=$SITE
CORS_ORIGINS=$SITE
TRUST_PROXY_HOPS=2
STORAGE_DRIVER=s3
S3_BUCKET=$WEBSITE_BUCKET
MEDIA_PUBLIC_BASE=$SITE
AWS_REGION=$AWS_REGION
MAIL_FROM=brochures@theprimedeveloper.com
TRACKER_SYNC_SECRET=\$(param TRACKER_SYNC_SECRET)
ENV
umask 022
chown -R ubuntu:ubuntu "\$APP"

# pnpm's build-script gate can skip Prisma's postinstall; generate explicitly.
cd apps/api
export DATABASE_URL="\${DB_URL}" DIRECT_URL="\${DB_URL}"
pnpm exec prisma generate 2>&1 | tail -1
# Creates the schema on the first run; afterwards only additive changes go through —
# anything that would drop data makes db push stop, and this deploy with it.
pnpm exec prisma db push --skip-generate 2>&1 | tail -2
psql "\${DB_URL}" -X -q -v ON_ERROR_STOP=1 <<'SQL'
create or replace function public.set_updated_at() returns trigger as \$\$
begin
  new.updated_at = now();
  return new;
end;
\$\$ language plpgsql;
drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at before update on public.content for each row execute function public.set_updated_at();
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at before update on public.news for each row execute function public.set_updated_at();
drop trigger if exists website_admin_users_set_updated_at on public.website_admin_users;
create trigger website_admin_users_set_updated_at before update on public.website_admin_users for each row execute function public.set_updated_at();
SQL
echo "schema in place"

# nginx: one included snippet inside the tracker's TLS server block.
SNIPPET=/etc/nginx/snippets/prime-website-api.conf
SITECONF=/etc/nginx/sites-enabled/prime-web
cat > "\$SNIPPET" <<'NGINX'
# Public website API (PrimeDevelopers-web), reached through the website's CloudFront
# distribution. Written by scripts/aws/02-deploy-api.sh in that repo.
location /website-api/ {
    proxy_pass http://127.0.0.1:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60s;
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    client_max_body_size 12m;
}
NGINX
if ! grep -q 'prime-website-api.conf' "\$SITECONF"; then
  BACKUP="/home/ubuntu/prime-web.nginx.bak.\$(date +%Y%m%d%H%M%S)"
  cp -p "\$SITECONF" "\$BACKUP"
  # Before the first location of the TLS block — the only block with /socket.io/.
  sed -i '0,/location \/socket.io\//s##include snippets/prime-website-api.conf;\n    location /socket.io/#' "\$SITECONF"
  if ! nginx -t 2>&1; then
    cp -p "\$BACKUP" "\$SITECONF"
    echo "nginx -t failed — previous config restored, nothing reloaded" >&2
    exit 1
  fi
  echo "nginx: website API location added (backup \$BACKUP)"
fi
nginx -t 2>&1 | tail -1
systemctl reload nginx

cd "\$APP/apps/api"
if sudo -u ubuntu HOME=/home/ubuntu pm2 describe prime-website-api >/dev/null 2>&1; then
  sudo -u ubuntu HOME=/home/ubuntu NODE_ENV=production pm2 restart prime-website-api --update-env 2>&1 | tail -2
else
  sudo -u ubuntu HOME=/home/ubuntu NODE_ENV=production pm2 start dist/main.js --name prime-website-api \
    --cwd "\$APP/apps/api" --max-memory-restart 300M --update-env 2>&1 | tail -2
  sudo -u ubuntu HOME=/home/ubuntu pm2 save 2>&1 | tail -1
fi

HOSTNAME_TLS=\$(grep -m1 -E '^\s*server_name' "\$SITECONF" | awk '{print \$2}' | tr -d ';')
for i in \$(seq 1 24); do
  if curl -sf http://127.0.0.1:3002/api/health >/dev/null; then
    echo "API healthy after \$(( i * 5 ))s"
    curl -s -o /dev/null -w "via nginx: %{http_code}\n" "https://\${HOSTNAME_TLS}/website-api/api/health" || true
    curl -s -o /dev/null -w "tracker still: %{http_code}\n" http://127.0.0.1:3001/api/health || true
    free -m | sed -n 2p
    exit 0
  fi
  sleep 5
done
echo "API did not become healthy" >&2
sudo -u ubuntu HOME=/home/ubuntu pm2 logs prime-website-api --lines 30 --nostream
exit 1
REMOTE
)"
