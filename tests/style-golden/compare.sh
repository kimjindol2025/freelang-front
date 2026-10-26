#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
list=$(mktemp)
trap 'rm -f "$list"' EXIT
find tests/style-golden/pages tests/style-golden/paired -type f | LC_ALL=C sort > "$list"
count=1
fail=0
cmp tests/style-golden/app.css public/app.css || fail=1
while IFS= read -r expected; do
  actual="tests/style-actual/${expected#tests/style-golden/}"
  if ! cmp "$expected" "$actual"; then fail=1; fi
  count=$((count + 1))
done < "$list"
printf 'STYLE_CMP_FILES=%s\nSTYLE_CMP_EXIT=%s\n' "$count" "$fail"
exit "$fail"
