#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec node fl-front-build.js "$@"
