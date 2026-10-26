#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
v11_root=${FL_V11_ROOT:?Set FL_V11_ROOT to the v11 checkout with the x86 native compiler}
compiler="$v11_root/bin/cgc-bin-x86_64-seed-v11"
runtime="$v11_root/runtime"
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT
find pages -type d | while IFS= read -r dir; do
  mkdir -p "tests/style-actual/$dir" "tests/style-actual/paired/${dir#pages/}"
done
"$compiler" style-compiler.fl "$temp_dir/style-compiler.c"
gcc -I "$runtime" -o "$temp_dir/style-compiler" "$temp_dir/style-compiler.c" \
  "$runtime/core.c" "$runtime/collection.c" "$runtime/io.c" \
  "$runtime/math.c" "$runtime/error.c" "$runtime/process.c" \
  "$runtime/json.c" "$runtime/cgc-bridge.c" -lm
"$temp_dir/style-compiler"
