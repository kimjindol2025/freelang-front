#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
node <<'JS'
const fs = require('fs');
const source = fs.readFileSync('island-compiler.js', 'utf8').replace(/^#![^\n]*\n/, '');
const { parse, extractIslands } = new Function('module', 'require', source + '\nreturn { parse, extractIslands };')({ exports: {} }, require);
for (const file of fs.readFileSync('tests/build-actual/island-pages.txt', 'utf8').trim().split('\n')) {
  const src = fs.readFileSync('tests/build-actual/pre-island-js/' + file, 'utf8');
  const asts = extractIslands(src).map(item => parse(item.block, item.startLine - 1));
  fs.writeFileSync('tests/build-actual/island-ast-js/' + file + '.json', JSON.stringify(asts) + '\n');
}
JS
reference_exit=$?
matched=0
different=0
total=0
normalized_expected=$(mktemp)
normalized_actual=$(mktemp)
trap 'rm -f "$normalized_expected" "$normalized_actual"' EXIT
while IFS= read -r file; do
  total=$((total + 1))
  expected="tests/build-actual/island-ast-js/$file.json"
  actual="tests/build-actual/island-ast/$file.json"
  node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))))' "$expected" > "$normalized_expected"
  node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))))' "$actual" > "$normalized_actual"
  if cmp "$normalized_expected" "$normalized_actual"; then
    matched=$((matched + 1))
  else
    printf 'AST_DIFF: %s\n' "$file"
    different=$((different + 1))
  fi
done < tests/build-actual/island-pages.txt
printf 'ISLAND_AST_TOTAL=%s\nISLAND_AST_MATCHED=%s\nISLAND_AST_DIFFERENT=%s\n' "$total" "$matched" "$different"
test "$reference_exit" -eq 0 && test "$different" -eq 0
