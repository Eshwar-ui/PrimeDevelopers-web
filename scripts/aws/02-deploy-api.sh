#!/usr/bin/env bash
# Deploy the website API to the tracker's EC2 host.
#
# Visitors reach it as <site>/api/... : CloudFront's /api/* behaviour (website.tf)
# forwards to https://<nip.io>/website-api/api/..., and nginx maps /website-api/ to
# 127.0.0.1:3002 — but only for requests carrying CloudFront's secret origin header.
#
# What this does, in order:
#   1. builds here (TypeScript output is platform-neutral) and uploads the artifact;
#   2. on the host, unpacks it into a new release directory and installs it there
#      (bcrypt, sharp and Prisma's engine are native and must match Linux) — the
#      running release is untouched;
#   3. if that release brings database migrations, snapshots RDS first;
#   4. applies migrations, switches `current` to the new release and restarts;
#   5. if the new release is not healthy, switches back and restarts the old one.
#
# The API runs as its own Linux user, `prime-website`, which cannot read the
# tracker's files. When Terraform has created the website's own IAM role
# (website-iam.tf), the process is also denied the instance's metadata service and
# gets short-lived credentials for that role instead — it can reach the website's
# media in S3 and nothing else.
source "$(dirname "$0")/lib.sh"

ROLE_ARN="$(aws ssm get-parameter --name "$PARAMS/APP_ROLE_ARN" --query Parameter.Value --output text 2>/dev/null || true)"
ORIGIN_HEADER_LIVE=no
if aws cloudfront get-distribution-config --id E25N0DCCIGFVRS --query 'DistributionConfig.Origins.Items[?Id==`website-api`].CustomHeaders.Items[].HeaderName' --output text 2>/dev/null | grep -qi 'x-origin-verify'; then
  ORIGIN_HEADER_LIVE=yes
fi
echo "website IAM role: ${ROLE_ARN:-not created yet — using the instance role}"
echo "CloudFront sends the origin header: $ORIGIN_HEADER_LIVE"

cd "$ROOT"
pnpm --filter @prime-developers/api run build
RELEASE="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$STAGE/website-api.tgz" \
  package.json pnpm-lock.yaml pnpm-workspace.yaml \
  apps/web/package.json \
  apps/api/package.json apps/api/prisma apps/api/dist
tar -tzf "$STAGE/website-api.tgz" >/dev/null
aws s3 cp "$STAGE/website-api.tgz" "s3://$STAGE_BUCKET/deploy/website-api-$RELEASE.tgz" --quiet
echo "uploaded release $RELEASE ($(du -h "$STAGE/website-api.tgz" | cut -f1))"

# ── 1. prepare: new release beside the running one ──────────────────────────
PREP_OUT="$STAGE/prepare.out"
ssm_script "website: prepare release $RELEASE" >"$PREP_OUT" <<REMOTE
#!/bin/bash
set -euo pipefail
APP=/srv/prime-website
REL=\$APP/releases/$RELEASE
param() { aws ssm get-parameter --name "$PARAMS/\$1" --with-decryption --region $AWS_REGION --query Parameter.Value --output text; }
as_app() { sudo -u prime-website -H env HOME=\$APP PM2_HOME=\$APP/.pm2 CI=true "\$@"; }

# The API's own user: no shell, no access to /home/ubuntu (750) or the tracker's .env (600).
id prime-website >/dev/null 2>&1 || useradd --system --home-dir \$APP --shell /usr/sbin/nologin prime-website
install -d -o prime-website -g prime-website -m 750 \$APP \$APP/releases \$APP/shared \$APP/.aws

install -d -o prime-website -g prime-website -m 750 \$REL
aws s3 cp s3://$STAGE_BUCKET/deploy/website-api-$RELEASE.tgz /tmp/website-api.tgz --region $AWS_REGION --quiet
tar -xzf /tmp/website-api.tgz -C \$REL 2>/dev/null && rm -f /tmp/website-api.tgz
chown -R prime-website:prime-website \$REL

# Rewritten whole on every deploy from SSM and the constants here, so nothing set by
# hand on the box survives. The RDS host comes from the tracker's connection string,
# read here as root and never written anywhere the website user can see.
MASTER=\$(grep -m1 '^DATABASE_URL=' /home/ubuntu/prime-tracker/apps/api/.env | cut -d= -f2- | tr -d '"')
DB_HOST=\$(echo "\$MASTER" | sed -E 's#^[a-z]+://[^@]+@([^:/?]+).*#\1#')
DB_URL="postgresql://prime_website:\$(param DB_PASSWORD)@\${DB_HOST}:5432/prime_website?sslmode=require"
umask 077
cat > \$APP/shared/.env <<ENV
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
chown prime-website:prime-website \$APP/shared/.env
ln -sfn \$APP/shared/.env \$REL/apps/api/.env

cd \$REL
as_app pnpm install --frozen-lockfile --filter @prime-developers/api 2>&1 | tail -2
cd apps/api
as_app pnpm exec prisma generate 2>&1 | tail -1

# The AWS database was created with \`db push\` before migrations existed. If its
# tables are there but Prisma's ledger is not, record the baseline as applied
# instead of trying to create everything again.
has_ledger=\$(psql "\$DB_URL" -XAtc "select to_regclass('public._prisma_migrations') is not null")
has_tables=\$(psql "\$DB_URL" -XAtc "select to_regclass('public.properties') is not null")
if [ "\$has_ledger" = f ] && [ "\$has_tables" = t ]; then
  as_app pnpm exec prisma migrate resolve --applied 0_init 2>&1 | tail -1
  as_app pnpm exec prisma migrate resolve --applied 1_updated_at_triggers 2>&1 | tail -1
  echo "baseline recorded"
fi
if as_app pnpm exec prisma migrate status >/tmp/website-migrate-status.txt 2>&1; then
  echo "MIGRATIONS_PENDING=0"
else
  grep -iE 'not yet been applied|following migration' /tmp/website-migrate-status.txt | head -5 || true
  echo "MIGRATIONS_PENDING=1"
fi
rm -f /tmp/website-migrate-status.txt
REMOTE
cat "$PREP_OUT"

# ── 2. snapshot before any migration ─────────────────────────────────────────
if grep -q '^MIGRATIONS_PENDING=1' "$PREP_OUT"; then
  SNAP="website-premigrate-$RELEASE"
  echo "migrations pending — snapshotting RDS as $SNAP first (several minutes)"
  aws rds create-db-snapshot --db-instance-identifier prime-tracker-db --db-snapshot-identifier "$SNAP" --query DBSnapshot.Status --output text
  aws rds wait db-snapshot-available --db-snapshot-identifier "$SNAP"
  echo "snapshot $SNAP available"
fi

# ── 3. activate ──────────────────────────────────────────────────────────────
ssm_script "website: activate release $RELEASE" <<REMOTE
#!/bin/bash
set -euo pipefail
APP=/srv/prime-website
REL=\$APP/releases/$RELEASE
as_app() { sudo -u prime-website -H env HOME=\$APP PM2_HOME=\$APP/.pm2 CI=true "\$@"; }
param() { aws ssm get-parameter --name "$PARAMS/\$1" --with-decryption --region $AWS_REGION --query Parameter.Value --output text; }

cd \$REL/apps/api
as_app pnpm exec prisma migrate deploy 2>&1 | tail -3

# ── credentials scoped to the website (once its IAM role exists) ──
if [ -n "$ROLE_ARN" ] && [ "$ROLE_ARN" != None ]; then
  cat > /usr/local/sbin/prime-website-creds <<'CREDS'
#!/bin/bash
# Assumes the website's own IAM role with the instance's credentials (root only) and
# hands the result to the prime-website user through credential_process. The SDK
# re-reads it when it expires; this runs every 20 minutes for 60-minute credentials.
set -euo pipefail
OUT=/srv/prime-website/.aws/creds.json
aws sts assume-role --role-arn "\$(cat /etc/prime-website-role-arn)" --role-session-name prime-website \
  --duration-seconds 3600 --output json --query Credentials |
  python3 -c 'import json,sys; c=json.load(sys.stdin); print(json.dumps({"Version":1,"AccessKeyId":c["AccessKeyId"],"SecretAccessKey":c["SecretAccessKey"],"SessionToken":c["SessionToken"],"Expiration":c["Expiration"]}))' >"\$OUT.tmp"
chown prime-website:prime-website "\$OUT.tmp" && chmod 400 "\$OUT.tmp" && mv -f "\$OUT.tmp" "\$OUT"
CREDS
  chmod 700 /usr/local/sbin/prime-website-creds
  echo "$ROLE_ARN" > /etc/prime-website-role-arn
  printf '[default]\nregion = $AWS_REGION\ncredential_process = /bin/cat /srv/prime-website/.aws/creds.json\n' > \$APP/.aws/config
  chown prime-website:prime-website \$APP/.aws/config
  cat > /etc/systemd/system/prime-website-creds.service <<'UNIT'
[Unit]
Description=Refresh the website API's AWS credentials
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/prime-website-creds
UNIT
  cat > /etc/systemd/system/prime-website-creds.timer <<'UNIT'
[Unit]
Description=Refresh the website API's AWS credentials every 20 minutes
[Timer]
OnBootSec=30s
OnUnitActiveSec=20min
[Install]
WantedBy=timers.target
UNIT
  # No metadata-service access for the website user, so it cannot fall back to the
  # instance role — which can read every tracker secret.
  cat > /etc/systemd/system/prime-website-imds-block.service <<'UNIT'
[Unit]
Description=Deny the prime-website user the EC2 instance metadata service
After=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'iptables -C OUTPUT -m owner --uid-owner prime-website -d 169.254.169.254 -j REJECT 2>/dev/null || iptables -I OUTPUT -m owner --uid-owner prime-website -d 169.254.169.254 -j REJECT'
[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now prime-website-imds-block.service >/dev/null
  systemctl start prime-website-creds.service
  systemctl enable --now prime-website-creds.timer >/dev/null
  test -s \$APP/.aws/creds.json && echo "scoped credentials in place; metadata service blocked for prime-website"
fi

# ── nginx: one included snippet inside the tracker's TLS server block ──
SNIPPET=/etc/nginx/snippets/prime-website-api.conf
SITECONF=/etc/nginx/sites-enabled/prime-web
ORIGIN_SECRET=\$(param ORIGIN_SECRET)
umask 077
{
  echo '# Public website API (PrimeDevelopers-web). Written by scripts/aws/02-deploy-api.sh.'
  echo 'location /website-api/ {'
  if [ "$ORIGIN_HEADER_LIVE" = yes ]; then
    echo '    # Only CloudFront knows this value (website.tf sends it). Anyone else reaching'
    echo '    # the host directly would also be able to choose their own X-Forwarded-For.'
    echo "    if (\\\$http_x_origin_verify != \"\$ORIGIN_SECRET\") { return 403; }"
  fi
  cat <<'NGINX'
    proxy_pass http://127.0.0.1:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Origin-Verify "";
    proxy_read_timeout 60s;
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    client_max_body_size 12m;
}
NGINX
} > \$SNIPPET.new
umask 022
SITE_BACKUP="/root/prime-web.nginx.bak.\$(date +%Y%m%d%H%M%S)"
cp -p "\$SITECONF" "\$SITE_BACKUP"
[ -f \$SNIPPET ] && cp -p \$SNIPPET \$SNIPPET.bak
mv -f \$SNIPPET.new \$SNIPPET
if ! grep -q 'prime-website-api.conf' "\$SITECONF"; then
  sed -i '0,/location \/socket.io\//s##include snippets/prime-website-api.conf;\n    location /socket.io/#' "\$SITECONF"
fi
# A config that fails the test is put back before anything reloads, so the tracker's
# next nginx reload (a deploy, a certificate renewal) never trips over it either.
if ! nginx -t 2>/tmp/nginx-test.txt; then
  cp -p "\$SITE_BACKUP" "\$SITECONF"
  if [ -f \$SNIPPET.bak ]; then mv -f \$SNIPPET.bak \$SNIPPET; else rm -f \$SNIPPET; fi
  cat /tmp/nginx-test.txt >&2
  echo "nginx config rejected — previous config restored, nothing reloaded" >&2
  exit 1
fi
rm -f \$SNIPPET.bak
systemctl reload nginx

# ── switch and restart, rolling back if the new release is unhealthy ──
PREVIOUS=\$(readlink \$APP/current 2>/dev/null || true)
ln -sfn \$REL \$APP/current

# One-time move from the first deploy, which ran under ubuntu's pm2.
if sudo -u ubuntu HOME=/home/ubuntu pm2 describe prime-website-api >/dev/null 2>&1; then
  sudo -u ubuntu HOME=/home/ubuntu pm2 delete prime-website-api >/dev/null
  sudo -u ubuntu HOME=/home/ubuntu pm2 save >/dev/null
  echo "moved prime-website-api off ubuntu's pm2"
fi
if as_app pm2 describe prime-website-api >/dev/null 2>&1; then
  as_app pm2 restart prime-website-api --update-env 2>&1 | tail -1
else
  as_app env NODE_ENV=production pm2 start \$APP/current/apps/api/dist/main.js --name prime-website-api \
    --cwd \$APP/current/apps/api --max-memory-restart 300M 2>&1 | tail -1
  env PATH=\$PATH:/usr/bin pm2 startup systemd -u prime-website --hp \$APP >/dev/null 2>&1 || true
fi
as_app pm2 save >/dev/null

healthy=no
for i in \$(seq 1 24); do
  if curl -sf http://127.0.0.1:3002/api/health/ready >/dev/null; then healthy=yes; break; fi
  sleep 5
done
if [ \$healthy = no ]; then
  echo "release $RELEASE is not healthy" >&2
  as_app pm2 logs prime-website-api --lines 30 --nostream >&2 || true
  if [ -n "\$PREVIOUS" ]; then
    ln -sfn "\$PREVIOUS" \$APP/current
    as_app pm2 restart prime-website-api --update-env >/dev/null
    echo "rolled back to \$(basename "\$PREVIOUS")" >&2
  fi
  exit 1
fi
echo "release $RELEASE healthy after \$(( i * 5 ))s"

HOSTNAME_TLS=\$(grep -m1 -E '^\s*server_name' "\$SITECONF" | awk '{print \$2}' | tr -d ';')
echo "direct, no header: \$(curl -s -o /dev/null -w '%{http_code}' "https://\${HOSTNAME_TLS}/website-api/api/health")  (403 once CloudFront sends the header)"
echo "direct, with header: \$(curl -s -o /dev/null -w '%{http_code}' -H "X-Origin-Verify: \$ORIGIN_SECRET" "https://\${HOSTNAME_TLS}/website-api/api/health")"
echo "tracker: \$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health)"

# Keep the three newest releases for rollback (scripts/aws/rollback-api.sh).
ls -1dt \$APP/releases/*/ | tail -n +4 | xargs -r rm -rf
free -m | sed -n 2p
REMOTE

purge_s3_key "deploy/website-api-$RELEASE.tgz"
echo "deployed $RELEASE"
