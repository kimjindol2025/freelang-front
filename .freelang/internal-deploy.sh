#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

base_url="${FL_FRONT_BASE_URL:-http://127.0.0.1:40860}"
commit="${FREELANG_INTERNAL_COMMIT:-$(git rev-parse HEAD)}"
build_json="/tmp/freelang-front-internal-build.json"
type_json="/tmp/freelang-front-internal-typecheck.json"
state_json="/tmp/freelang-front-internal-statecheck.json"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "INTERNAL_DEPLOY=BLOCKED"
  echo "CAUSE=dirty-worktree"
  git status --short
  exit 3
fi

node fl-front-build.js --json > "$build_json"
node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!x.ok || x.summary.errors!==0) process.exit(1); console.log(`BUILD_PASS routes=${x.routes.length} errors=${x.summary.errors}`)' "$build_json"

node scripts/front-typecheck.js --json > "$type_json"
node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!x.pass) process.exit(1); console.log("TYPECHECK_PASS source+generated")' "$type_json"

node scripts/state-contract-gate.js --json > "$state_json"
node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!x.pass) process.exit(1); console.log("STATE_CONTRACT_PASS")' "$state_json"
node scripts/ui-contract-gate.js >/tmp/freelang-front-internal-ui.txt

artifact_hash="$(sha256sum _app.fl public/app.css server.fl | sha256sum | awk '{print $1}')"
if [[ "${FL_INTERNAL_DEPLOY_DRY_RUN:-0}" == 1 ]]; then
  echo "INTERNAL_DEPLOY=DRY_RUN_PASS"
  echo "INTERNAL_DEPLOY_COMMIT=$commit"
  echo "ARTIFACT_HASH=$artifact_hash"
  echo "ROLLBACK_TARGET=$(git rev-parse --short "$commit")"
  echo "PM2=SKIPPED"
  echo "SMOKE=SKIPPED"
  exit 0
fi

pm2 startOrRestart ecosystem.config.js --only freelang-front >/tmp/freelang-front-internal-pm2.txt 2>&1
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$base_url/front" 2>/dev/null || true)"
  if [[ "$code" == 200 ]]; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "INTERNAL_DEPLOY=FAIL"
  echo "CAUSE=app-not-ready"
  exit 4
fi

FL_FRONT_BASE_URL="$base_url" bash .freelang/smoke.sh
BASE_URL="$base_url" node scripts/sse-contract-gate.js
BASE_URL="$base_url" node scripts/spa-contract-gate.js
echo "INTERNAL_DEPLOY=PASS"
echo "INTERNAL_DEPLOY_COMMIT=$commit"
echo "ARTIFACT_HASH=$artifact_hash"
echo "ROLLBACK_TARGET=$(git rev-parse --short "$commit")"
