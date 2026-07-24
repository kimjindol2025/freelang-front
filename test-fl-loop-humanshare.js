#!/usr/bin/env node
/**
 * test-fl-loop-humanshare.js — humanShare 리포트 계약 검증
 *   node test-fl-loop-humanshare.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const FIX = path.join(ROOT, 'pages', 'hs-fixture');
const INDEX = path.join(FIX, 'index.flx');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function runDry() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'fl-front-loop.js'), '--dry'], {
    encoding: 'utf8',
    env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
    maxBuffer: 32 * 1024 * 1024,
    cwd: ROOT,
  });
  const text = (r.stdout || '').trim();
  if (!text) fail('empty stdout: ' + (r.stderr || '').slice(0, 200));
  return JSON.parse(text);
}

// fixture
fs.mkdirSync(FIX, { recursive: true });
fs.writeFileSync(
  INDEX,
  `; TEMP test humanShare — DO NOT COMMIT
; (defn dead-in-comment [x] x)
(define FOO-BAR-BAZ 1)
(defn render [req]
  (totally-undefined-hs-test 1)
  (server-json {"ok" true "v" FOO-BAR-BAZ}))
`,
  'utf8'
);

try {
  const d = runDry();
  const requiredOld = [
    'schema', 'tool', 'dry', 'max', 'converged', 'reason',
    'machineApplicable', 'remainingFixable', 'remainingFixableCount',
    'buildOk', 'lastSummary', 'rounds', 'manifest',
  ];
  for (const k of requiredOld) {
    if (!(k in d)) fail('missing legacy field: ' + k);
  }
  if (d.schema !== 'fl-loop/1') fail('schema must stay fl-loop/1');
  if (typeof d.humanShare !== 'number') fail('humanShare must be number');
  if (!Array.isArray(d.humanShareItems)) fail('humanShareItems must be array');
  if (!d.autoFixed || !Array.isArray(d.autoFixed.codes)) fail('autoFixed.codes missing');
  if (!d.meaning || !d.meaning.note) fail('meaning.note missing');

  if (d.converged !== true) fail('expected converged true on human-only fixture');
  if (d.remainingFixableCount !== 0) fail('expected remainingFixableCount 0');
  if (d.humanShare < 1) fail('expected humanShare >= 1, got ' + d.humanShare);
  if (d.humanShareItems.length !== d.humanShare) fail('humanShare count mismatch list');

  const codes = new Set(d.humanShareItems.map(i => i.code));
  if (!codes.has('upper-hyphen') && !codes.has('undefined-fn') && !codes.has('comment-defn')) {
    fail('expected at least one known human code, got ' + [...codes]);
  }
  for (const it of d.humanShareItems) {
    if (!('code' in it && 'file' in it && 'line' in it && 'reason' in it)) {
      fail('humanShareItems entry missing fields: ' + JSON.stringify(it));
    }
  }

  console.log('PASS: fl-loop/1 legacy fields intact; humanShare=%d; meaning=%s',
    d.humanShare, d.meaning.note);
} finally {
  fs.rmSync(FIX, { recursive: true, force: true });
}
