#!/usr/bin/env bash
# End-to-end smoke test for the API.
#
#   bash apps/api/test/smoke.sh      (with the API running on :3001)
#
# Requires a seeded admin — see prisma/seed-admin.ts — with the credentials
# below. Leave ~60s between consecutive runs: the last block deliberately trips
# the 5/min login limit, so an immediate re-run can't authenticate.
set -uo pipefail
B=http://localhost:3001/api
pass=0; fail=0
# Slugs are unique, so a fixed one would collide on the second run and the
# suite would only pass against a fresh database.
RUN=$(date +%s)
chk() { # chk <label> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "  ✓ $1 ($3)"; pass=$((pass+1));
  else echo "  ✗ $1 — expected $2, got $3"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "── public reads (no token) ──"
chk "GET /content"                200 "$(code $B/content)"
chk "GET /properties"             200 "$(code $B/properties)"
chk "GET /news"                   200 "$(code $B/news)"
chk "GET /properties/nope → 404"  404 "$(code $B/properties/nope)"

echo "── admin routes reject anonymous ──"
chk "GET /admin/properties"       401 "$(code $B/admin/properties)"
chk "GET /admin/news"             401 "$(code $B/admin/news)"
chk "GET /admin/leads"            401 "$(code $B/admin/leads)"
chk "PUT /content/hero"           401 "$(code -X PUT -H 'Content-Type: application/json' -d '{"data":{}}' $B/content/hero)"
chk "GET /auth/me"                401 "$(code $B/auth/me)"

echo "── login ──"
chk "wrong password → 401"        401 "$(code -X POST -H 'Content-Type: application/json' -d '{"email":"admin@prime.test","password":"wrongpassword"}' $B/auth/login)"
chk "unknown email → 401"         401 "$(code -X POST -H 'Content-Type: application/json' -d '{"email":"nobody@prime.test","password":"whateverpass"}' $B/auth/login)"
chk "malformed email → 400"       400 "$(code -X POST -H 'Content-Type: application/json' -d '{"email":"notanemail","password":"whateverpass"}' $B/auth/login)"

TOK=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@prime.test","password":"correct-horse-battery"}' $B/auth/login)
AT=$(echo "$TOK" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
RT=$(echo "$TOK" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')
[ -n "$AT" ] && { echo "  ✓ login returned an access token"; pass=$((pass+1)); } \
             || { echo "  ✗ login returned no access token: $TOK"; fail=$((fail+1)); }
A=(-H "Authorization: Bearer $AT")

echo "── admin routes accept a valid token ──"
chk "GET /auth/me"                200 "$(code "${A[@]}" $B/auth/me)"
chk "GET /admin/properties"       200 "$(code "${A[@]}" $B/admin/properties)"
chk "GET /admin/leads"            200 "$(code "${A[@]}" $B/admin/leads)"
chk "garbage token → 401"         401 "$(code -H 'Authorization: Bearer not.a.token' $B/admin/properties)"

echo "── validation ──"
chk "unknown field rejected"      400 "$(code "${A[@]}" -X POST -H 'Content-Type: application/json' -d '{"name":"X","slug":"x","evil":1}' $B/admin/properties)"
chk "bad uuid path → 400"         400 "$(code "${A[@]}" -X DELETE $B/admin/properties/not-a-uuid)"

echo "── create a property (admin) ──"
P=$(curl -s "${A[@]}" -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Plaza\",\"slug\":\"smoke-plaza-$RUN\",\"published\":true,\"detail\":{\"units\":[]}}" $B/admin/properties)
PID=$(echo "$P" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$PID" ] && { echo "  ✓ created ($PID)"; pass=$((pass+1)); } || { echo "  ✗ create failed: $P"; fail=$((fail+1)); }
chk "now visible publicly"        200 "$(code $B/properties/smoke-plaza-$RUN)"

echo "── draft is hidden from the public ──"
curl -s "${A[@]}" -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Draft\",\"slug\":\"draft-prop-$RUN\",\"published\":false}" $B/admin/properties > /dev/null
chk "public GET draft → 404"      404 "$(code $B/properties/draft-prop-$RUN)"
chk "admin GET draft → 200"       200 "$(code "${A[@]}" $B/admin/properties/draft-prop-$RUN)"

echo "── public lead submission ──"
chk "valid lead → 201"            201 "$(code -X POST -H 'Content-Type: application/json' -d '{"name":"Jo","email":"jo@example.com","message":"hi"}' $B/leads)"
chk "bad email → 400"             400 "$(code -X POST -H 'Content-Type: application/json' -d '{"name":"Jo","email":"nope"}' $B/leads)"
chk "half attribution → 400"      400 "$(code -X POST -H 'Content-Type: application/json' -d "{\"name\":\"Jo\",\"email\":\"jo@example.com\",\"propertyId\":\"$PID\"}" $B/leads)"
chk "stale propertyId → 400"      400 "$(code -X POST -H 'Content-Type: application/json' -d '{"name":"Jo","email":"jo@example.com","propertyId":"00000000-0000-0000-0000-000000000000","unitLabel":"A1"}' $B/leads)"

L=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Attributed\",\"email\":\"a@example.com\",\"propertyId\":\"$PID\",\"unitLabel\":\"A-101\",\"buildingLabel\":\"Tower A\"}" $B/leads)
echo "$L" | grep -q 'A-101' && { echo "  ✓ lead + attribution written together"; pass=$((pass+1)); } \
                            || { echo "  ✗ attribution missing: $L"; fail=$((fail+1)); }

echo "── refresh rotation ──"
R1=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}" $B/auth/refresh)
echo "$R1" | grep -q accessToken && { echo "  ✓ refresh issued a new pair"; pass=$((pass+1)); } \
                                 || { echo "  ✗ refresh failed: $R1"; fail=$((fail+1)); }
RT2=$(echo "$R1" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')
chk "reusing old refresh → 401"   401 "$(code -X POST -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}" $B/auth/refresh)"

echo "── logout revokes ──"
chk "logout → 204"                204 "$(code -X POST -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT2\"}" $B/auth/logout)"
chk "refresh after logout → 401"  401 "$(code -X POST -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT2\"}" $B/auth/refresh)"
chk "logout is idempotent → 204"  204 "$(code -X POST -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT2\"}" $B/auth/logout)"

echo "── uploads: auth and validation ──"
# Fixtures are generated here so the test stays self-contained.
TMP=$(mktemp -d)
printf '\x89PNG\r\n\x1a\n' > "$TMP/px.png"
echo hello > "$TMP/notes.txt"
chk "anonymous upload → 401"      401 "$(code -X POST -F "file=@$TMP/px.png" -F 'folder=x/y' $B/uploads/image)"
chk "no file → 400"               400 "$(code "${A[@]}" -X POST -F 'folder=x/y' $B/uploads/image)"
chk ".txt as image → 400"         400 "$(code "${A[@]}" -X POST -F "file=@$TMP/notes.txt" -F 'folder=x/y' $B/uploads/image)"
chk ".txt as model → 400"         400 "$(code "${A[@]}" -X POST -F "file=@$TMP/notes.txt;type=text/plain" -F 'folder=x/y' $B/uploads/model)"
chk "missing folder → 400"        400 "$(code "${A[@]}" -X POST -F "file=@$TMP/px.png" $B/uploads/image)"
# A valid file gets past validation. With storage configured that's a 201; with
# SUPABASE_SERVICE_ROLE_KEY unset it's a 500 naming the missing variables.
# Either proves validation passed — a 400 here would mean it didn't.
UP=$(code "${A[@]}" -X POST -F "file=@$TMP/px.png" -F 'folder=x/y' $B/uploads/image)
case "$UP" in
  201|500) echo "  ✓ valid image passes validation ($UP)"; pass=$((pass+1));;
  *)       echo "  ✗ valid image rejected ($UP)"; fail=$((fail+1));;
esac
rm -rf "$TMP"

# Last, because it deliberately exhausts the login budget: the limit is 5/min
# per IP, so anything needing a fresh token after this point would fail.
echo "── login rate limit (6th attempt in a minute) ──"
for _ in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST -H 'Content-Type: application/json' \
    -d '{"email":"admin@prime.test","password":"wrongpassword"}' $B/auth/login
done
chk "6th login → 429"             429 "$(code -X POST -H 'Content-Type: application/json' -d '{"email":"admin@prime.test","password":"wrongpassword"}' $B/auth/login)"

echo
echo "════ $pass passed, $fail failed ════"
exit $((fail > 0 ? 1 : 0))
