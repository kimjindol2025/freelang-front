#!/usr/bin/env node
/**
 * Next90 내부 release gate.
 *
 * 정본 코드와 사용자 dirty 변경을 분리해서 확인한다.
 * - BASE_URL이 없으면 HTTP 항목은 BLOCKED로 남긴다.
 * - 이 스크립트는 stage/commit/push/deploy를 하지 않는다.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FX_RUNNER = process.env.FREELANG_AFJ_RUNNER || '/home/kim/kim/platform/freelang-v11-fx/bootstrap.js';
const BASE_URL = process.env.BASE_URL || process.env.FL_FRONT_BASE_URL || '';

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    exit: result.status === null ? 1 : result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

function lastJson(output) {
  const whole = output.trim();
  try { return JSON.parse(whole); } catch {}
  const lines = output.split(/\r?\n/).map(s => s.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}

function pass(name, detail) { return { name, status: 'PASS', detail }; }
function blocked(name, detail) { return { name, status: 'BLOCKED', detail }; }
function fail(name, detail) { return { name, status: 'FAIL', detail }; }

const checks = [];

const build = run(process.execPath, ['fl-front-build.js', '--json']);
const buildJson = lastJson(build.output);
if (build.exit === 0 && buildJson?.ok && buildJson.summary?.errors === 0) {
  checks.push(pass('build', `errors=${buildJson.summary.errors} warnings=${buildJson.summary.warnings} routes=${buildJson.routes.length}`));
} else {
  checks.push(fail('build', `exit=${build.exit}`));
}

const ai = run(process.execPath, ['scripts/ai-contract-gate.js']);
const aiJson = lastJson(ai.output);
checks.push(ai.exit === 0 && aiJson?.pass === true
  ? pass('ai-contract', `errors=${aiJson.build?.issues?.filter?.(x => x.level === 'error').length ?? 0}`)
  : fail('ai-contract', `exit=${ai.exit}`));

const ui = run(process.execPath, ['scripts/ui-contract-gate.js']);
const uiJson = lastJson(ui.output);
checks.push(ui.exit === 0 && uiJson?.pass === true
  ? pass('ui-contract', `violations=${uiJson.violations?.length ?? 0}`)
  : fail('ui-contract', `exit=${ui.exit}`));

const typecheck = run('fl-tools', ['check', ROOT], { FREELANG_AFJ_RUNNER: FX_RUNNER });
const typecheckPass = typecheck.exit === 0 && /FREELANG_CHECK=PASS/.test(typecheck.output);
checks.push(typecheckPass ? pass('typecheck', 'official FX runner') : fail('typecheck', `exit=${typecheck.exit}`));

const islandBuild = run(process.execPath, ['fl-front-build.js']);
const islandPass = islandBuild.exit === 0
  && /Island 테스트 \d+\/\d+ PASS/.test(islandBuild.output)
  && /island 경계 이상 없음/.test(islandBuild.output);
checks.push(islandPass ? pass('island-regression', 'build-integrated') : fail('island-regression', 'build-integrated test missing or failed'));

for (const script of ['test-fl-loop-humanshare.js', 'test-fl-comment-defn-narrow.js', 'test-fl-req-key-collision.js']) {
  const result = run(process.execPath, [script]);
  checks.push(result.exit === 0 ? pass(script, 'regression') : fail(script, `exit=${result.exit}`));
}

const dirty = run('git', ['status', '--porcelain']);
const cleanDeploy = dirty.output.trim() === '';
checks.push(cleanDeploy
  ? pass('clean-worktree', 'clean')
  : blocked('clean-worktree', 'existing user changes preserved'));

if (BASE_URL) {
  const app = run(process.execPath, ['tests/next90-app-matrix.js'], { BASE_URL });
  checks.push(app.exit === 0 ? pass('next90-app', BASE_URL) : fail('next90-app', `exit=${app.exit}`));
  const smoke = run('bash', ['.freelang/smoke.sh'], { FL_FRONT_BASE_URL: BASE_URL });
  checks.push(smoke.exit === 0 ? pass('internal-smoke', BASE_URL) : fail('internal-smoke', `exit=${smoke.exit}`));
} else {
  checks.push(blocked('next90-app', 'BASE_URL is required for real HTTP verification'));
  checks.push(blocked('internal-smoke', 'BASE_URL is required for real HTTP verification'));
}

const failures = checks.filter(x => x.status === 'FAIL');
const blockedChecks = checks.filter(x => x.status === 'BLOCKED');
const result = {
  schema: 'fl-next90-gate/1',
  repo: path.basename(ROOT),
  head: run('git', ['rev-parse', '--short', 'HEAD']).output.trim(),
  pass: failures.length === 0 && blockedChecks.length === 0,
  checks,
  known_limitations: ['SSE endpoints remain 501; dashboard uses polling fallback', 'browser console may report cancelled ViewTransition during rapid navigation'],
};

console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 2);
