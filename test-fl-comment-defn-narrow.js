#!/usr/bin/env node
/**
 * test-fl-comment-defn-narrow.js — comment-defn 은 비활성 코드 형태만
 *   node test-fl-comment-defn-narrow.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const FIX = path.join(ROOT, 'pages', 'cdn-fixture');
const INDEX = path.join(FIX, 'index.flx');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function buildJson() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'fl-front-build.js'), '--json'], {
    encoding: 'utf8',
    env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
    maxBuffer: 32 * 1024 * 1024,
    cwd: ROOT,
  });
  const text = (r.stdout || '').trim();
  if (!text) fail('empty stdout: ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(text);
}

fs.mkdirSync(FIX, { recursive: true });
fs.writeFileSync(
  INDEX,
  `; TEMP comment-defn narrow — DO NOT COMMIT
; 예제: (defn render [req]) 하나로 그리는 페이지
; (defn dead-in-comment [x] x)
(defn render [req]
  (server-json {"ok" true}))
`,
  'utf8'
);

try {
  const d = buildJson();
  const hits = (d.diagnostics || []).filter(
    x => x.code === 'comment-defn' && String(x.file).includes('index.flx')
  );
  if (hits.length !== 1) {
    fail('expected exactly 1 comment-defn (disabled code only), got ' + hits.length);
  }
  // mid-sentence educational line must not warn on examples after narrow
  const edu = (d.diagnostics || []).filter(
    x =>
      x.code === 'comment-defn' &&
      (String(x.file).includes('01-hello') || String(x.file).includes('04-form'))
  );
  if (edu.length !== 0) {
    fail('educational mid-sentence still flagged: ' + JSON.stringify(edu));
  }
  console.log('PASS: comment-defn narrow — dead code=1 mid-sentence examples=0');
} finally {
  fs.rmSync(FIX, { recursive: true, force: true });
}
