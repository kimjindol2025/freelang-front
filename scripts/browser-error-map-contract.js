#!/usr/bin/env node
'use strict';

const { normalizeBrowserError, resolveGeneratedLocation } = require('../browser-error-map');
const { compileFileIslands } = require('../island-compiler');

const state = {
  sourceMapLines: {
    '240': { file: 'pages/dashboard.flx', line: 18, column: 1 },
  },
  sourceMap: { '300-320': 'pages/legacy.flx' },
};

const mapped = normalizeBrowserError({
  type: 'error',
  message: 'runtime failure',
  source: '_app.fl',
  line: 240,
  col: 9,
  stack: 'Error: runtime failure\n    at _app.fl:240:9',
}, state);
const legacy = resolveGeneratedLocation(305, 4, {}, state.sourceMap);
const island = normalizeBrowserError({
  type: 'island',
  message: 'island failure',
  source: 'island-counter.flx',
  stack: 'Error: island failure\n    at render (pages/examples/counter.flx:42:7)',
}, state);
const islandSource = compileFileIslands('\n\n(island Counter [] "ok")', {
  sourceFile: 'pages/examples/counter.flx',
}).scripts[0];
const pass = mapped.source === 'pages/dashboard.flx'
  && mapped.line === 18
  && mapped.col === 9
  && mapped.source_location?.file === 'pages/dashboard.flx'
  && mapped.source_location?.line === 18
  && mapped.generated_location?.line === 240
  && legacy?.file === 'pages/legacy.flx'
  && legacy.line === 6
  && island.source_location?.file === 'pages/examples/counter.flx'
  && island.source_location?.line === 42
  && islandSource.includes('//# sourceURL=pages/examples/counter.flx:3:1');

process.stdout.write(`${JSON.stringify({
  schema: 'fl-front-browser-error-map-contract/1',
  pass,
  mapped,
  legacy,
  island,
  island_source_url: islandSource.split('\n').pop(),
})}\n`);
process.exitCode = pass ? 0 : 1;
