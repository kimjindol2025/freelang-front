#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const catalogPath = path.join(ROOT, 'stdlib', 'libraries.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const required = new Set(catalog.required_now);
const results = catalog.libraries.map(library => {
  const sourceOk = library.source && library.source.split(' + ').every(source => fs.existsSync(path.join(ROOT, source)));
  return { id: library.id, status: library.status, source: library.source, source_ok: Boolean(sourceOk) };
});
const missing = results.filter(item => required.has(item.id) && !item.source_ok);
const testSource = path.join(ROOT, 'stdlib', 'flx-test.flx');
const testFixture = path.join(ROOT, 'tests', 'flx-test-contract.fl');
const schemaFixture = path.join(ROOT, 'tests', 'flx-schema-fixture-contract.fl');
const runtime = process.env.FREELANG_AFJ_RUNNER || path.join(ROOT, 'runtime', 'bootstrap.js');
const execution = spawnSync(process.execPath, [runtime, 'run', 'tests/flx-test-contract.fl'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
});
// bootstrap's bundled runner may write println output directly through its
// native channel when spawned non-interactively; exit 0 is the stable signal.
const runtimePass = execution.status === 0;
const pass = catalog.schema === 'fl-front-libraries/1'
  && missing.length === 0
  && fs.existsSync(testSource)
  && fs.existsSync(testFixture)
  && fs.existsSync(schemaFixture)
  && runtimePass;
const schemaExecution = spawnSync(process.execPath, [runtime, 'run', 'tests/flx-schema-fixture-contract.fl'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
});
const schemaRuntimePass = schemaExecution.status === 0;
const finalPass = pass && schemaRuntimePass;
console.log(JSON.stringify({ schema: 'fl-front-library-contract/1', pass: finalPass, required_now: [...required], libraries: results, missing, runtime_test: runtimePass, schema_fixture_test: schemaRuntimePass }));
process.exit(finalPass ? 0 : 2);
