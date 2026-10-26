#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
expected=$(mktemp)
actual=$(mktemp)
trap 'rm "$expected" "$actual"' EXIT
sed '2{/^; 생성: /d;}' tests/build-golden/_app.fl > "$expected"
sed '2{/^; 생성: /d;}' _app.fl > "$actual"
failed=0
cmp "$expected" "$actual" || failed=$((failed + 1))
cmp tests/build-golden/app.css public/app.css || failed=$((failed + 1))
cmp tests/build-golden/build-state.json .build-state.json || failed=$((failed + 1))
sha256sum -c tests/build-golden/build-cache.sha256 || failed=$((failed + 1))
sha256sum -c tests/build-golden/AGENTS.sha256 || failed=$((failed + 1))
printf 'BUILD_CMP_FILES=5\nBUILD_CMP_FAILURES=%s\n' "$failed"
test "$failed" -eq 0
