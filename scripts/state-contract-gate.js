#!/usr/bin/env node
/**
 * Targeted executable contract for the Front atom/store model.
 * Schema: fl-state-contract/1
 */
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');
const file = path.join(ROOT, 'pages/examples/34-state-contract.flx');
const result = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'), file,
  '--island=statewriter', '--click=button',
], { cwd: ROOT, encoding: 'utf8' });

let run = null;
try { run = JSON.parse(result.stdout); } catch (_) {}
const row = run?.results?.[0];
const pass = result.status === 0
  && run?.ok === true
  && row?.store?.['state-message'] === 'updated'
  && row?.store?.['state-count'] === 1;

const output = {
  schema: 'fl-state-contract/1',
  tool: 'freelang-front',
  fixture: 'pages/examples/34-state-contract.flx',
  checks: [{
    name: 'batch-dispatch',
    status: pass ? 'PASS' : 'FAIL',
    detail: pass
      ? 'map dispatch updates declared state-message and state-count'
      : 'targeted state fixture failed',
  }],
  pass,
};

if (JSON_MODE || !process.stdout.isTTY) process.stdout.write(`${JSON.stringify(output)}\n`);
else console.log(`STATE_CONTRACT=${pass ? 'PASS' : 'FAIL'} ${output.checks[0].detail}`);
process.exit(pass ? 0 : 1);
