#!/usr/bin/env bash
# Downloads every real photo from the client's Reagan Crossing Drive folder
# (scripts/reagan-crossing-drive-manifest.json) into reagan-crossing-drive-photos/,
# mirroring the Drive's own folder structure. Skips files already on disk, so
# it is safe to re-run after an interruption. Not committed to git — see
# .gitignore.
set -u
OUT="reagan-crossing-drive-photos"
MANIFEST="scripts/reagan-crossing-drive-manifest.json"

python -I -c "
import json
d = json.load(open(r'$MANIFEST', encoding='utf-8'))
for folder, files in d.items():
    for name, fid in files.items():
        print(f'{folder}{name}\t{fid}')
" > /tmp_jobs.tsv 2>/dev/null || python -I -c "
import json
d = json.load(open(r'$MANIFEST', encoding='utf-8'))
for folder, files in d.items():
    for name, fid in files.items():
        print(f'{folder}{name}\t{fid}')
" > jobs.tsv

JOBS_FILE="jobs.tsv"
[ -f /tmp_jobs.tsv ] && JOBS_FILE=/tmp_jobs.tsv

total=$(wc -l < "$JOBS_FILE")
echo "Manifest: $total files"

download_one() {
  local relpath="$1" fid="$2"
  local dest="$OUT/$relpath"
  mkdir -p "$(dirname "$dest")"
  if [ -s "$dest" ]; then
    return 0
  fi
  curl -sL --max-time 60 "https://drive.google.com/uc?export=download&id=$fid" -o "$dest.part"
  if [ -s "$dest.part" ]; then
    mv "$dest.part" "$dest"
  else
    rm -f "$dest.part"
    echo "FAILED: $relpath ($fid)" >> download-failures.log
  fi
}
export -f download_one
export OUT

cat "$JOBS_FILE" | xargs -P 8 -I{} -d'\n' bash -c '
  line="{}"
  relpath="${line%%	*}"
  fid="${line##*	}"
  download_one "$relpath" "$fid"
'

rm -f "$JOBS_FILE" /tmp_jobs.tsv
echo "Done. $(find "$OUT" -type f | wc -l) files on disk in $OUT/"
[ -f download-failures.log ] && echo "Failures logged in download-failures.log:" && cat download-failures.log
