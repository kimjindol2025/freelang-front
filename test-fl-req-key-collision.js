#!/usr/bin/env node
/**
 * test-fl-req-key-collision.js — req-key-collision 검출·오검출·fix
 *   node test-fl-req-key-collision.js
 * 픽스처는 실행 중만 pages/rkc-fixture 에 두고 finally 삭제 (커밋 금지).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { fixReqKeyCollision } = require('./fl-front-fix');

const ROOT = __dirname;
const FIX = path.join(ROOT, 'pages', 'rkc-fixture');
const BAD = path.join(FIX, 'index.flx');
const OK = path.join(FIX, 'ok.flx');

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
  if (!text) fail('empty build stdout: ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(text);
}

fs.mkdirSync(FIX, { recursive: true });
fs.writeFileSync(
  BAD,
  `; TEMP req-key-collision — DO NOT COMMIT
(defn render [req]
  (let [body (get req "body")
        t (get body "text")
        f (form-get req "text")]
    (h! "input" {:type "text" :name "text"})
    (server-json {"ok" true "t" t "f" f})))
`,
  'utf8'
);
fs.writeFileSync(
  OK,
  `; TEMP false-positive controls — DO NOT COMMIT
(defn render [req]
  (let [body (get req "body")
        c (get body "content")
        a (get body "action")
        i (get body "id")]
    (h! "input" {:type "text" :name "content"})
    (server-json {"ok" true "c" c "a" a "i" i})))
`,
  'utf8'
);

try {
  const d = buildJson();
  const hits = (d.diagnostics || []).filter(
    x => x.code === 'req-key-collision' && String(x.file).includes('index.flx')
  );
  if (hits.length < 1) fail('expected req-key-collision on bad fixture, got 0');

  const fp = (d.diagnostics || []).filter(
    x => x.code === 'req-key-collision' && String(x.file).includes('ok.flx')
  );
  if (fp.length !== 0) fail('false positive on action/id/content/:type text: ' + JSON.stringify(fp));

  const meta = (d.diagnosticCodes || []).find(c => c.code === 'req-key-collision');
  if (!meta || meta.applicability !== 'machine-applicable') {
    fail('req-key-collision must be machine-applicable in catalog');
  }

  const sample = `(get body "text") (form-get req "text") {:type "text" :name "text"} (get body "action")`;
  const fixed = fixReqKeyCollision(sample);
  if (fixed.count !== 3) fail('fix count expected 3, got ' + fixed.count);
  if (!fixed.code.includes('(get body "content")')) fail('fix miss get body');
  if (!fixed.code.includes('(form-get req "content")')) fail('fix miss form-get');
  if (!fixed.code.includes(':name "content"')) fail('fix miss :name');
  if (!fixed.code.includes('{:type "text"')) fail('must not rewrite :type text');
  if (!fixed.code.includes('(get body "action")')) fail('must not rewrite action');

  // apply+rebuild: rewrite bad fixture then expect 0 rkc on that file
  const applied = fixReqKeyCollision(fs.readFileSync(BAD, 'utf8'));
  fs.writeFileSync(BAD, applied.code, 'utf8');
  const d2 = buildJson();
  const left = (d2.diagnostics || []).filter(
    x => x.code === 'req-key-collision' && String(x.file).includes('index.flx')
  );
  if (left.length !== 0) fail('after fix still has req-key-collision: ' + JSON.stringify(left));
  if (!d2.ok) fail('rebuild not ok after fix');

  console.log('PASS: req-key-collision detect=%d fix=%d falsePositive=0 rebuildOk',
    hits.length, applied.count);
} finally {
  fs.rmSync(FIX, { recursive: true, force: true });
}
