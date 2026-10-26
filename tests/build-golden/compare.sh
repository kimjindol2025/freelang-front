#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
expected=$(mktemp)
actual=$(mktemp)
trap 'rm "$expected" "$actual"' EXIT
failed=0
if test -f tests/build-actual/_app.fl; then
  sed '2{/^; 생성: /d;}' tests/build-golden/_app.fl > "$expected"
  sed '2{/^; 생성: /d;}' tests/build-actual/_app.fl > "$actual"
  cmp "$expected" "$actual" || failed=$((failed + 1))
else
  printf 'MISSING: tests/build-actual/_app.fl\n'
  failed=$((failed + 1))
fi
for name in app.css build-state.json; do
  if test -f "tests/build-actual/$name"; then
    cmp "tests/build-golden/$name" "tests/build-actual/$name" || failed=$((failed + 1))
  else
    printf 'MISSING: tests/build-actual/%s\n' "$name"
    failed=$((failed + 1))
  fi
done
for name in build-cache AGENTS; do
  file=$(if test "$name" = AGENTS; then printf 'AGENTS.md'; else printf '.build-cache.json'; fi)
  if test -f "tests/build-actual/$file"; then
    actual_hash=$(sha256sum "tests/build-actual/$file" | cut -d ' ' -f 1)
    expected_hash=$(cut -d ' ' -f 1 "tests/build-golden/$name.sha256")
    if test "$actual_hash" = "$expected_hash"; then
      printf '%s: OK\n' "$file"
    else
      printf '%s: DIFFERENT\n' "$file"
      failed=$((failed + 1))
    fi
  else
    printf 'MISSING: tests/build-actual/%s\n' "$file"
    failed=$((failed + 1))
  fi
done
printf 'BUILD_CMP_FILES=5\nBUILD_CMP_FAILURES=%s\n' "$failed"
test "$failed" -eq 0
