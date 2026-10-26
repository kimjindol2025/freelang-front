#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
node fl-front-build.js
cp _app.fl tests/build-golden/_app.fl
cp public/app.css tests/build-golden/app.css
cp .build-cache.json tests/build-golden/build-cache.json
cp .build-state.json tests/build-golden/build-state.json
# AGENTS.md is already tracked; record its exact bytes without duplicating its local path examples.
sha256sum AGENTS.md > tests/build-golden/AGENTS.sha256
