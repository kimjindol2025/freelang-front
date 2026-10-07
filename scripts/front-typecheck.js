#!/usr/bin/env node
/**
 * FreeLang Front type-check contract.
 *
 * The source tree and the generated `_app.fl` have different responsibilities:
 * fl-tools checks the source-side `.fl` files, while the canonical FX runner
 * must also inspect the generated Front artifact. Build first, then run this
 * command. It never rewrites source or generated files.
 *
 * Schema: fl-front-typecheck/1
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = process.env.FREELANG_AFJ_RUNNER
  || '/home/kim/kim/platform/freelang-v11-fx/bootstrap.js';
const JSON_MODE = process.argv.includes('--json');
const GENERATED = path.join(ROOT, '_app.fl');

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    exit: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function tail(text, count = 12) {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-count);
}

function sourceCheck() {
  const result = run('fl-tools', ['check', ROOT], {
    FREELANG_AFJ_RUNNER: RUNNER,
  });
  const pass = result.exit === 0 && /FREELANG_CHECK=PASS/.test(result.stdout + result.stderr);
  return {
    name: 'source',
    status: pass ? 'PASS' : 'FAIL',
    command: result.command,
    exit: result.exit,
    detail: pass ? 'official fl-tools source check' : 'source check failed',
    evidence: tail(result.stdout + result.stderr),
  };
}

function generatedCheck() {
  if (!fs.existsSync(GENERATED)) {
    return {
      name: 'generated',
      status: 'FAIL',
      command: `node ${RUNNER} check _app.fl`,
      exit: 2,
      detail: '_app.fl missing; run npm run build first',
      evidence: [],
    };
  }
  if (!fs.existsSync(RUNNER)) {
    return {
      name: 'generated',
      status: 'FAIL',
      command: `node ${RUNNER} check _app.fl`,
      exit: 2,
      detail: `FX runner not found: ${RUNNER}`,
      evidence: [],
    };
  }
  const result = run('node', [RUNNER, 'check', GENERATED]);
  const pass = result.exit === 0;
  return {
    name: 'generated',
    status: pass ? 'PASS' : 'FAIL',
    command: result.command,
    exit: result.exit,
    detail: pass ? 'canonical FX runner checks _app.fl' : 'generated artifact type-check failed',
    evidence: tail(result.stdout + result.stderr),
  };
}

const checks = [sourceCheck(), generatedCheck()];
const result = {
  schema: 'fl-front-typecheck/1',
  tool: 'freelang-front',
  runner: RUNNER,
  artifact: '_app.fl',
  checks,
  pass: checks.every((check) => check.status === 'PASS'),
};

if (JSON_MODE || !process.stdout.isTTY) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  for (const check of checks) {
    console.log(`${check.name}=${check.status} ${check.detail}`);
    for (const line of check.evidence) console.log(`  ${line}`);
  }
  console.log(`FRONT_TYPECHECK=${result.pass ? 'PASS' : 'FAIL'}`);
}

process.exit(result.pass ? 0 : 1);
