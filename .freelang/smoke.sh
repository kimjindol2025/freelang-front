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
check_page "/crew/jiwoo" "지우와의 작업 대화"
api_status="$(curl -sS -o "$tmp_body" -w '%{http_code}' --max-time 15 \
  "${base_url}/api/hello")"
if [[ "$api_status" != "200" ]] || ! rg -F -q '"ok":true' "$tmp_body"; then
  echo "SMOKE_FAIL path=/api/hello status=${api_status}" >&2
  exit 1
fi
echo "SMOKE_PASS path=/api/hello method=GET status=200 json-contract"

echo "SMOKE_PASS all=7 base=${base_url}"
