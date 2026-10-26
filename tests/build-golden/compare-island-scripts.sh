#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
node <<'JS'
const fs = require('fs');
const compiler = require('./island-compiler');
for (const file of fs.readFileSync('tests/build-actual/island-pages.txt', 'utf8').trim().split('\n')) {
  const src = fs.readFileSync('tests/build-actual/pre-island-js/' + file, 'utf8');
  const blocks = compiler.extractIslands(src).map(i => i.block).join('\n');
  const text = compiler.compileFileIslands(blocks).scripts.join('\n') + '\n';
  fs.writeFileSync('tests/build-actual/island-scripts-js/' + file + '.txt', text);
}
JS
reference_exit=$?
matched=0
different=0
total=0
while IFS= read -r file; do
  total=$((total + 1))
  expected="tests/build-actual/island-scripts-js/$file.txt"
  actual="tests/build-actual/island-scripts/$file.txt"
  if cmp "$expected" "$actual"; then
    matched=$((matched + 1))
  else
    printf 'SCRIPT_DIFF: %s\n' "$file"
    different=$((different + 1))
  fi
done < tests/build-actual/island-pages.txt
printf 'ISLAND_SCRIPT_TOTAL=%s\nISLAND_SCRIPT_MATCHED=%s\nISLAND_SCRIPT_DIFFERENT=%s\n' "$total" "$matched" "$different"
test "$reference_exit" -eq 0 && test "$different" -eq 0
