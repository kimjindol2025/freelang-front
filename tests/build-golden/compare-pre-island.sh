#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
node <<'JS' > /tmp/f5-reference-build.log 2>&1
const fs = require('fs');
const path = require('path');
const Module = require('module');
const file = path.resolve('fl-front-build.js');
const source = fs.readFileSync(file, 'utf8');
const marker = '    // 2) (island ...) 블록 컴파일';
if (source.split(marker).length !== 2) throw new Error('reference hook changed');
const hook = `    fs.mkdirSync(path.dirname(path.join(__dirname, 'tests/build-actual/pre-island-js', r.file)), { recursive: true });\n    fs.writeFileSync(path.join(__dirname, 'tests/build-actual/pre-island-js', r.file), src, 'utf8');\n`;
const build = new Module(file);
build.filename = file;
build.paths = Module._nodeModulePaths(path.dirname(file));
build._compile(source.replace(marker, hook + marker), file);
JS
reference_exit=$?
printf 'REFERENCE_JS_EXIT=%s\n' "$reference_exit"
total=0
matched=0
different=0
while IFS= read -r file; do
  total=$((total + 1))
  if cmp "tests/build-actual/pre-island-js/$file" "tests/build-actual/pre-island/$file"; then
    matched=$((matched + 1))
  else
    different=$((different + 1))
    printf 'PRE_ISLAND_DIFF: %s\n' "$file"
  fi
done <<EOF_LIST
$(find pages -type f -name '*.flx' ! -name '_*' | LC_ALL=C sort)
EOF_LIST
printf 'PRE_ISLAND_TOTAL=%s\nPRE_ISLAND_MATCHED=%s\nPRE_ISLAND_DIFFERENT=%s\n' "$total" "$matched" "$different"
test "$reference_exit" -eq 0 && test "$different" -eq 0
