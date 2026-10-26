#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
node fl-front-build.js
cp _app.fl tests/build-golden/_app.fl
cp public/app.css tests/build-golden/app.css
cp .build-state.json tests/build-golden/build-state.json
# These files contain local paths; record their exact bytes by digest without publishing those paths.
sha256sum .build-cache.json > tests/build-golden/build-cache.sha256
sha256sum AGENTS.md > tests/build-golden/AGENTS.sha256
