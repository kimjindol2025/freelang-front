#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
expected=$(mktemp)
list=$(mktemp)
trap 'rm "$expected" "$list"' EXIT
find pages -type f -name '*.flx' | LC_ALL=C sort > "$list"
total=0
matched=0
different=0
while IFS= read -r file; do
  total=$((total + 1))
  node -e '
    const fs = require("fs"), vm = require("vm");
    const source = fs.readFileSync("fl-front-build.js", "utf8");
    const start = source.indexOf("function removeStyleBlocks(src)");
    const end = source.indexOf("const OUT_FILE", start);
    const remove = vm.runInNewContext(source.slice(start, end) + ";removeStyleBlocks");
    process.stdout.write(remove(fs.readFileSync(process.argv[1], "utf8")));
  ' "$file" > "$expected"
  if cmp "$expected" "tests/build-actual/stripped/$file"; then
    matched=$((matched + 1))
  else
    different=$((different + 1))
    printf 'STYLE_REMOVAL_DIFF: %s\n' "$file"
  fi
done < "$list"
printf 'STYLE_REMOVAL_TOTAL=%s\nSTYLE_REMOVAL_MATCHED=%s\nSTYLE_REMOVAL_DIFFERENT=%s\n' \
  "$total" "$matched" "$different"
test "$different" -eq 0
