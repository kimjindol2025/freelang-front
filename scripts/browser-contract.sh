#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${FL_FRONT_BASE_URL:-http://127.0.0.1:40860}"
browser_url="${FL_BROWSER_DEBUG_URL:-http://127.0.0.1:9222}"

if ! curl -fsS --max-time 2 "$browser_url/json/version" >/dev/null; then
  echo "BROWSER_CONTRACT=BLOCKED"
  echo "CAUSE=CDP_UNAVAILABLE browser_url=$browser_url"
  exit 3
fi

node fl-browser.js attach active --browser-url "$browser_url" --url "$base_url/people" >/tmp/freelang-front-browser-attach.json
node fl-browser.js check active --browser-url "$browser_url" \
  --goto "$base_url/people" \
  --selector '#island-peopleapp-0' \
  --selector 'a[data-spa][href="/market"]' >/tmp/freelang-front-browser-people.json
node fl-browser.js check active --browser-url "$browser_url" \
  --click 'a[data-spa][href="/market"]' \
  --selector '#island-marketapp-0' >/tmp/freelang-front-browser-market.json
node fl-browser.js check active --browser-url "$browser_url" \
  --click 'button.mk-btn.mk-accent' \
  --selector '.mk-form' \
  --selector '.mk-form input' >/tmp/freelang-front-browser-form.json

node - <<'NODE'
const fs = require('node:fs');
const files = [
  '/tmp/freelang-front-browser-people.json',
  '/tmp/freelang-front-browser-market.json',
  '/tmp/freelang-front-browser-form.json',
];
const rows = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const passed = rows.every((row) => row.browser?.result === 'PASS');
for (const row of rows) {
  const b = row.browser || {};
  console.log(`BROWSER_STEP ${b.url || 'unknown'} result=${b.result} console=${b.console_errors} network=${b.network_errors}`);
}
console.log(`BROWSER_CONTRACT=${passed ? 'PASS' : 'FAIL'} steps=${rows.length}`);
process.exit(passed ? 0 : 1);
NODE
