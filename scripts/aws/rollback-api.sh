#!/usr/bin/env bash
# Put the website API back on the previous release.
#
#   scripts/aws/rollback-api.sh
#
# 02-deploy-api.sh keeps the three newest releases in /srv/prime-website/releases and
# rolls back by itself when a new one fails its health check; this is the same move
# for a release that started fine and turned out wrong later. It does not undo
# database migrations — restore the `website-premigrate-*` RDS snapshot the deploy
# took if the schema has to go back too.
source "$(dirname "$0")/lib.sh"

ssm_script "website: roll back API" <<'REMOTE'
#!/bin/bash
set -euo pipefail
APP=/srv/prime-website
current=$(readlink "$APP/current")
previous=$(ls -1dt "$APP"/releases/*/ | sed 's#/$##' | grep -vx "$current" | head -1)
[ -n "$previous" ] || { echo "no earlier release to go back to" >&2; exit 1; }
ln -sfn "$previous" "$APP/current"
sudo -u prime-website -H env HOME=$APP PM2_HOME=$APP/.pm2 pm2 restart prime-website-api --update-env >/dev/null
for i in $(seq 1 24); do
  curl -sf http://127.0.0.1:3002/api/health/ready >/dev/null && { echo "now on $(basename "$previous") (was $(basename "$current"))"; exit 0; }
  sleep 5
done
echo "previous release is not healthy either" >&2
exit 1
REMOTE
