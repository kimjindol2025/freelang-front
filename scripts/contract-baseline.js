#!/usr/bin/env node
'use strict';

// 현재 HEAD에서 계약 검수 결과가 PASS일 때만 last_verified commit을 갱신한다.
// 실제 계약 검수 없이 hash만 바꾸는 행위를 막기 위해 build JSON을 먼저 확인한다.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const head = String(cp.execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT })).trim();
const run = cp.spawnSync(process.execPath, ['fl-front-build.js', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
let report = null;
try {
  const first = run.stdout.indexOf('{');
  const last = run.stdout.lastIndexOf('}');
  if (first >= 0 && last > first) report = JSON.parse(run.stdout.slice(first, last + 1));
} catch (_) {}

const contracts = report?.contracts || [];
const pending = contracts.filter((row) => row.readiness !== 'complete');
const eligible = contracts.filter((row) =>
  row.readiness === 'in_progress'
  && row.route
  && row.check_summary?.total > 0
  && row.check_summary?.fail === 0
);
if (run.status !== 0 || report?.summary?.errors > 0 || eligible.length !== pending.length) {
  process.stdout.write(JSON.stringify({
    schema: 'fl-front-contract-baseline/1',
    pass: false,
    head,
    exit: run.status,
    contract_count: contracts.length,
    eligible: eligible.length,
    reason: 'syntax/error/contract check did not produce all eligible PASS rows',
  }) + '\n');
  process.exit(1);
}

const updated = [];
function findSource(name) {
  const pending = [path.join(ROOT, 'pages')];
  while (pending.length) {
    const dir = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.name === name) return full;
    }
  }
  return null;
}
for (const row of eligible) {
  const file = findSource(row.file);
  if (!file) continue;
  const source = fs.readFileSync(file, 'utf8');
  const next = source.replace(/(;\s*commit:)\s*\S+/g, `$1 ${head}`);
  if (next !== source) {
    fs.writeFileSync(file, next, 'utf8');
    updated.push(path.relative(ROOT, file));
  }
}

process.stdout.write(JSON.stringify({
  schema: 'fl-front-contract-baseline/1',
  pass: updated.length === eligible.length,
  head,
  updated,
  next: 'run npm run build:json, inspect diff, then commit baseline lines',
}) + '\n');
process.exit(updated.length === eligible.length ? 0 : 1);
