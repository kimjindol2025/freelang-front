#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
v11_root=${FL_V11_ROOT:?Set FL_V11_ROOT to the v11 checkout with the x86 native compiler}
runtime="$v11_root/runtime"
temp_dir=$(mktemp -d)
trap 'rm -r "$temp_dir"' EXIT
mkdir -p tests/build-actual
sh scripts/build-style-fl.sh
cp public/app.css tests/build-actual/app.css
"$v11_root/bin/cgc-bin-x86_64-seed-v11" build.fl "$temp_dir/build.c"
gcc -I "$runtime" -o "$temp_dir/build" "$temp_dir/build.c" \
  "$runtime/core.c" "$runtime/collection.c" "$runtime/io.c" \
  "$runtime/math.c" "$runtime/error.c" "$runtime/process.c" \
  "$runtime/json.c" "$runtime/cgc-bridge.c" -lm
"$temp_dir/build"
