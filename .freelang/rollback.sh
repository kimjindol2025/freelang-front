#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "ROLLBACK_BLOCKED reason=missing-verified-commit" >&2
  echo "Usage: .freelang/rollback.sh <verified-commit>" >&2
  exit 2
fi

git cat-file -e "${target}^{commit}" 2>/dev/null || {
  echo "ROLLBACK_BLOCKED reason=unknown-commit target=${target}" >&2
  exit 2
}

if [[ "${FL_ROLLBACK_APPLY:-0}" != "1" ]]; then
  echo "ROLLBACK_PLAN target=$(git rev-parse --short "$target")"
  echo "ROLLBACK_BLOCKED reason=explicit-apply-required set FL_ROLLBACK_APPLY=1 only after operator review" >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ROLLBACK_BLOCKED reason=dirty-worktree" >&2
  git status --short >&2
  exit 2
fi

git switch --detach "$target"
echo "ROLLBACK_APPLIED commit=$(git rev-parse --short HEAD)"
