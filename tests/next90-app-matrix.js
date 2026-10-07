#!/usr/bin/env node
/**
 * Next-90 stage 10 runtime matrix.
 *
 * The server is intentionally external to this fixture: it must already be
 * started through the project's documented Front entrypoint. This keeps the
 * test from silently validating a second, differently configured server.
 */
'use strict';

const assert = require('assert');
const http = require('http');

const base = process.env.FL_FRONT || 'http://127.0.0.1:40860';

function request(path, options = {}) {
  const url = new URL(path, base);
  const body = options.body == null ? null : Buffer.from(JSON.stringify(options.body));
  const headers = { ...(options.headers || {}) };
  if (body) headers['content-type'] = 'application/json';
  if (body) headers['content-length'] = body.length;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || (body ? 'POST' : 'GET'),
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error(`timeout ${path}`)));
    if (body) req.write(body);
    req.end();
  });
}

function assertJsonOk(response, label) {
  assert.strictEqual(response.status, 200, `${label} status=${response.status}`);
  let parsed;
  assert.doesNotThrow(() => { parsed = JSON.parse(response.text); }, `${label} JSON`);
  assert.notStrictEqual(parsed, null, `${label} body`);
  return parsed;
}

async function main() {
  const pages = [
    ['/people', ['People', '연락']],
    ['/market', ['Market']],
    ['/flow', ['Flow']],
    ['/dashboard', ['성능 대시보드']],
  ];
  for (const [path, markers] of pages) {
    const response = await request(path);
    assert.strictEqual(response.status, 200, `${path} status=${response.status}`);
    for (const marker of markers) {
      assert.ok(response.text.includes(marker), `${path} missing marker ${marker}`);
    }
    console.log(`NEXT90_PAGE_PASS path=${path} status=200 markers=${markers.length}`);
  }

  const apis = ['/people/api', '/market/api', '/followups/api'];
  for (const path of apis) {
    const parsed = assertJsonOk(await request(path), path);
    assert.ok(Array.isArray(parsed.items), `${path} items array`);
    console.log(`NEXT90_API_PASS path=${path} items=${parsed.items.length}`);
  }

  const notFound = await request('/__next90_not_found__');
  assert.strictEqual(notFound.status, 404, `404 status=${notFound.status}`);
  console.log('NEXT90_404_PASS status=404');
  console.log(`next90 app matrix: PASS base=${base}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
