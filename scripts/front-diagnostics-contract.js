#!/usr/bin/env node
'use strict';

// FreeLang Front 문법 오류가 fl-diagnostics/1 JSON으로 재현되는지 확인한다.
// 원본 worktree에는 fixture를 복사하지 않고 임시 build tree에서만 실행한다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const fixture = path.join(ROOT, 'tests/fixtures/front-invalid-parens.flx');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-front-diagnostics-'));
const skip = (source) => !source.includes(`${path.sep}.git${path.sep}`)
  && !source.includes(`${path.sep}node_modules${path.sep}`)
  && !source.endsWith(`${path.sep}_app.fl`)
  && !source.endsWith(`${path.sep}.build-state.json`);

try {
  fs.cpSync(ROOT, temp, { recursive: true, filter: skip });
  const target = path.join(temp, 'pages/diagnostics-invalid.flx');
  fs.copyFileSync(fixture, target);
  const run = spawnSync(process.execPath, ['fl-front-build.js', '--json'], {
    cwd: temp,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report = null;
  try {
    const first = run.stdout.indexOf('{');
    const last = run.stdout.lastIndexOf('}');
    if (first >= 0 && last > first) report = JSON.parse(run.stdout.slice(first, last + 1));
  } catch (_) {}
  const diagnostics = report?.diagnostics || [];
  const syntax = diagnostics.find((item) => item.code === 'syntax');
  const requiredFields = [
    'code', 'severity', 'file', 'line', 'column', 'source', 'generated',
    'message', 'hint', 'fixable', 'applicability',
  ];
  const schemaComplete = diagnostics.length > 0 && diagnostics.every((item) =>
    requiredFields.every((field) => Object.prototype.hasOwnProperty.call(item, field))
    && item.source
    && typeof item.source.file === 'string'
    && Number.isInteger(item.source.line)
    && Number.isInteger(item.source.column)
    && (item.generated === null || (
      typeof item.generated === 'object'
      && typeof item.generated.file === 'string'
      && Number.isInteger(item.generated.line)
      && Number.isInteger(item.generated.column)
    ))
  );
  const sourceMapLines = report?.sourceMapLines || {};
  const sourceMapKeys = Object.keys(sourceMapLines);
  const sourceMapComplete = sourceMapKeys.length > 0 && sourceMapKeys.every((key) => {
    const item = sourceMapLines[key];
    return /^\d+$/.test(key)
      && item
      && typeof item.file === 'string'
      && item.file.startsWith('pages/')
      && Number.isInteger(item.line)
      && item.line >= 1
      && Number.isInteger(item.column)
      && item.column >= 1;
  });
  const pass = run.status !== 0
    && report?.schema === 'fl-diagnostics/1'
    && report?.ok === false
    && syntax?.severity === 'error'
    && syntax?.file === 'pages/diagnostics-invalid.flx'
    && syntax?.line === 1
    && typeof syntax?.hint === 'string'
    && syntax.hint.length > 0
    && schemaComplete
    && sourceMapComplete;
  const output = {
    schema: 'fl-front-diagnostics-contract/1',
    pass,
    exit: run.status,
    build_schema: report?.schema || null,
    diagnostic: syntax || null,
    schema_complete: schemaComplete,
    source_map_lines: sourceMapKeys.length,
    source_map_complete: sourceMapComplete,
    stdout_tail: (run.stdout || '').trim().split(/\r?\n/).slice(-8),
    stderr: (run.stderr || '').trim().split(/\r?\n/).slice(-8),
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exit(pass ? 0 : 1);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
