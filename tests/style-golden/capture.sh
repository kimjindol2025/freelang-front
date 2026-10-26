#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
mkdir -p tests/style-golden/pages
node style-compiler.js >/dev/null
cp public/app.css tests/style-golden/app.css
find pages -type f -name '*.flx' | LC_ALL=C sort | while IFS= read -r file; do
  dest="tests/style-golden/${file%.flx}.css"
  mkdir -p "$(dirname "$dest")"
  node -e 'const fs = require("fs"); const c = require("./style-compiler"); fs.writeFileSync(process.argv[2], c.compilePageCSS(process.argv[1]).rawCss)' "$file" "$dest"
done
find pages -type f -name '*.css' | LC_ALL=C sort | while IFS= read -r file; do
  dest="tests/style-golden/paired/${file#pages/}"
  mkdir -p "$(dirname "$dest")"
  perl -0777 -ne 's/\s+/ /g; s/^ //; s/ $//; print' "$file" > "$dest"
done
