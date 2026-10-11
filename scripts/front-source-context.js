#!/usr/bin/env node
'use strict';

// AI가 브라우저 없이 FreeLang Front 원본 위치와 주변 코드를 조회하는 CLI.
// 계약: fl-front-source-context/1

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveGeneratedLocation } = require('../browser-error-map');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] || fallback) : fallback;
}
function fail(message) {
  process.stdout.write(`${JSON.stringify({
    schema: 'fl-front-source-context/1',
    ok: false,
    error: { code: 'source-context', message },
  })}\n`);
  process.exitCode = 1;
}

const requested = arg('--file');
const requestedLine = Number(arg('--line', '0')) || 0;
const requestedColumn = Number(arg('--col', '0')) || 0;
if (!requested) fail('--file pages/example.flx 또는 --file _app.fl 필요');
else {
  const segments = requested.split('/');
  const safe = segments.every((segment) => segment && segment !== '.' && segment !== '..');
  const allowed = safe && (requested === '_app.fl'
    || /^(?:pages|components|src)\/[^\\/]+(?:\/[^\\/]+)*\.(?:flx|fl)$/.test(requested));
  if (!allowed) fail('pages/components/src 내부의 .flx/.fl 파일 또는 _app.fl만 조회할 수 있습니다');
  else {
    let buildState = {};
    try { buildState = JSON.parse(fs.readFileSync(path.join(ROOT, '.build-state.json'), 'utf8')); } catch {}
    let file = requested;
    let line = requestedLine;
    let generated = null;
    if (requested === '_app.fl' && requestedLine > 0) {
      const mapped = resolveGeneratedLocation(
        requestedLine,
        requestedColumn,
        buildState.sourceMapLines || {},
        buildState.sourceMap || {},
      );
      if (mapped) {
        file = mapped.file;
        line = mapped.line;
        generated = mapped.generated;
      }
    }
    const fullPath = path.resolve(ROOT, file);
    const relative = path.relative(ROOT, fullPath);
    const inside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!inside || !fs.existsSync(fullPath)) fail(`소스 파일을 찾을 수 없습니다: ${file}`);
    else {
      const sourceLines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
      const center = Math.min(sourceLines.length, Math.max(1, line || 1));
      const from = Math.max(1, center - 5);
      const to = Math.min(sourceLines.length, center + 5);
      const context = [];
      for (let n = from; n <= to; n += 1) context.push({ line: n, text: sourceLines[n - 1] || '', focus: n === center });
      process.stdout.write(`${JSON.stringify({
        schema: 'fl-front-source-context/1',
        ok: true,
        requested: { file: requested, line: requestedLine, column: requestedColumn },
        source: { file, line: center, column: requestedColumn },
        generated,
        context,
        evidence: {
          repo_commit: buildState.repoCommit || '',
          build_time: buildState.time || null,
          command: 'node fl-front-build.js --json',
          sha256: crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex'),
        },
      })}\n`);
    }
  }
}
