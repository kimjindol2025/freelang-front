#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if [[ "${1:-check}" != "check" ]]; then
  echo "DEPLOY_BLOCKED mode=${1:-} reason=internal-only-contract-supports-check-only" >&2
  echo "Run the server through the documented internal operator workflow after review." >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "DEPLOY_BLOCKED reason=dirty-worktree" >&2
  git status --short >&2
  exit 2
fi

check_dir="$(mktemp -d /tmp/freelang-front-deploy-check.XXXXXX)"
trap 'rm -rf "$check_dir"' EXIT
git clone --no-local "$repo_dir" "$check_dir" >/tmp/freelang-front-deploy-clone.log 2>&1
node "$check_dir/fl-front-build.js" --json > /tmp/fl-front-deploy-build.json
node -e 'const fs=require("fs"); const x=JSON.parse(fs.readFileSync("/tmp/fl-front-deploy-build.json","utf8")); if(!x.ok || x.summary.errors!==0) process.exit(1); console.log(`DEPLOY_CHECK_PASS commit=${x.repoCommit||"unknown"} routes=${x.routes.length} errors=${x.summary.errors} isolated=true`)'
echo "DEPLOY_CHECK_PASS next=.freelang/smoke.sh"
