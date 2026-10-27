#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
flock -n /tmp/fl-heavy.lock sh -c '
set -eu
tmp=$(mktemp -d)
trap "rm -rf \"$tmp\"" EXIT
sh scripts/build-js-reference.sh
cp _app.fl AGENTS.md public/app.css "$tmp/"
strace -f -e trace=openat -o "$tmp/native-openat.log" sh scripts/build-fl.sh
js_opens=$(grep -E "openat\\(.*\\.js\"" "$tmp/native-openat.log" | wc -l | tr -d ' ')
css=0; app=0; agents=0
cmp "$tmp/app.css" public/app.css || css=1
sed "2{/^; 생성: /d;}" "$tmp/_app.fl" > "$tmp/js-app"
sed "2{/^; 생성: /d;}" tests/build-actual/_app.fl > "$tmp/fl-app"
cmp "$tmp/js-app" "$tmp/fl-app" || app=1
cmp "$tmp/AGENTS.md" tests/build-actual/AGENTS.md || agents=1
printf "CSS_MATCH=%s\nAPP_MATCH=%s\nAGENTS_MATCH=%s\n" "$((1-css))" "$((1-app))" "$((1-agents))"
printf "JS_OPENAT_COUNT=%s\n" "$js_opens"
sh tests/style-golden/compare.sh
sh tests/build-golden/compare-sections.sh
sh tests/build-golden/compare-island-scripts.sh
if test "$css$app$agents" != 000 || test "$js_opens" -ne 0; then exit 1; fi
printf "BUILD_CMP_SUMMARY=5/5\n"
'
