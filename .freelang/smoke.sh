#!/usr/bin/env bash
set -euo pipefail

base_url="${FL_FRONT_BASE_URL:-http://127.0.0.1:40860}"
tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

check_page() {
  local path="$1"
  local marker="${2:-}"
  local status
  status="$(curl -sS -o "$tmp_body" -w '%{http_code}' --max-time 15 "${base_url}${path}")"
  if [[ "$status" != "200" ]]; then
    echo "SMOKE_FAIL path=${path} status=${status}" >&2
    return 1
  fi
  if [[ -n "$marker" ]] && ! rg -F -q "$marker" "$tmp_body"; then
    echo "SMOKE_FAIL path=${path} marker=${marker}" >&2
    return 1
  fi
  echo "SMOKE_PASS path=${path} status=200"
}

check_page "/people"
check_page "/market"
check_page "/flow"
check_page "/dashboard"
check_page "/examples/33-ui-components" "UI 컴포넌트 계약"
api_status="$(curl -sS -o "$tmp_body" -w '%{http_code}' --max-time 15 \
  -X POST -H 'content-type: application/json' \
  --data '{"question":"","options":[]}' "${base_url}/api/decision")"
if [[ "$api_status" != "400" ]] || ! rg -F -q "question과 options가 필요합니다" "$tmp_body"; then
  echo "SMOKE_FAIL path=/api/decision status=${api_status}" >&2
  exit 1
fi
echo "SMOKE_PASS path=/api/decision method=POST status=400 validation"

echo "SMOKE_PASS all=6 base=${base_url}"
