# Shared by scripts/aws/*.sh — sourced, not run.
#
# Moving the website onto the tracker's AWS account (prime-tracker-main/infra/terraform):
#   01-database.sh   secrets + the prime_website database on the tracker's RDS
#   02-deploy-api.sh the website API as a second process on the tracker's EC2 host
#   03-copy-data.sh  Supabase rows and files -> RDS and S3, URLs rewritten
#   ../deploy-web-aws.sh  the front end -> S3 + CloudFront
# See docs/tracker-sync-and-aws-plan.md, Phase 2.

set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-prime-client}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="056836825737"
INSTANCE="i-0412241c8f6d080a1"
# Private (presigned-URL only) and already readable by the EC2 role — staging for
# artifacts and the data export, never the website bucket, which CloudFront serves.
STAGE_BUCKET="prime-tracker-documents-${ACCOUNT}"
WEBSITE_BUCKET="prime-tracker-website-${ACCOUNT}"
SITE="https://dtw8rs0oq8bpp.cloudfront.net"
PARAMS="/prime-tracker/website"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Under the repo, not /tmp: a sandboxed shell can redirect /tmp per process, and the
# tracker's deploy once shipped a stale tarball because of exactly that.
STAGE="$ROOT/.aws-stage"
mkdir -p "$STAGE"

# The default CLI credentials on this machine belong to the old test account.
actual="$(aws sts get-caller-identity --query Account --output text)"
if [ "$actual" != "$ACCOUNT" ]; then
  echo "AWS profile $AWS_PROFILE is account $actual, not $ACCOUNT. Run: aws sso login --profile prime-client" >&2
  exit 1
fi

# Runs a bash script on the EC2 host as root through SSM, printing its output and
# failing when it fails. The script travels through the private staging bucket rather
# than the command line, so nothing it contains lands in SSM's command history.
ssm_script() {
  local comment="$1" body="$2" key cmd status
  key="deploy/website-run-$$-${RANDOM}.sh"
  printf '%s\n' "$body" | aws s3 cp - "s3://$STAGE_BUCKET/$key" --quiet
  cmd=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
    --comment "$comment" --timeout-seconds 1800 \
    --parameters "commands=[\"aws s3 cp s3://$STAGE_BUCKET/$key /tmp/website-step.sh --region $AWS_REGION --quiet && bash /tmp/website-step.sh; rc=\$?; rm -f /tmp/website-step.sh; exit \$rc\"]" \
    --query Command.CommandId --output text)
  until status=$(aws ssm get-command-invocation --command-id "$cmd" --instance-id "$INSTANCE" \
    --query Status --output text 2>/dev/null) && [[ "$status" =~ ^(Success|Failed|TimedOut|Cancelled)$ ]]; do
    sleep 5
  done
  aws ssm get-command-invocation --command-id "$cmd" --instance-id "$INSTANCE" \
    --query StandardOutputContent --output text
  aws ssm get-command-invocation --command-id "$cmd" --instance-id "$INSTANCE" \
    --query StandardErrorContent --output text >&2
  aws s3 rm "s3://$STAGE_BUCKET/$key" --quiet || true
  [ "$status" = "Success" ] || { echo "SSM step '$comment' ended $status" >&2; exit 1; }
}

# Creates a SecureString parameter once and never overwrites it: rotating a secret
# is a deliberate act, not a side effect of re-running a deploy step.
ensure_secret() {
  local name="$PARAMS/$1" bytes="$2"
  if ! aws ssm get-parameter --name "$name" >/dev/null 2>&1; then
    aws ssm put-parameter --name "$name" --type SecureString \
      --value "$(openssl rand -hex "$bytes")" >/dev/null
    echo "created $name"
  fi
}
