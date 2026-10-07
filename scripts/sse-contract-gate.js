#!/usr/bin/env node
/**
 * Real HTTP SSE contract gate.
 * Schema: fl-sse-contract/1
 */
'use strict';

const assert = require('node:assert');
const http = require('node:http');

const base = process.env.BASE_URL || process.env.FL_FRONT_BASE_URL || 'http://127.0.0.1:40860';

function request(path, options = {}) {
  const url = new URL(path, base);
  const body = options.body == null ? null : Buffer.from(JSON.stringify(options.body));
  const headers = { ...(options.headers || {}) };
  if (body) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = body.length;
  }
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

function waitForStream(path, payload, eventPredicate, label) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    let buffer = '';
    let stream;
    let ready = false;
    let settled = false;
    let resolveReady;
    let resolveEvent;
    const readyPromise = new Promise((r) => { resolveReady = r; });
    const eventPromise = new Promise((r) => { resolveEvent = r; });
    const timer = setTimeout(() => finish(new Error(`${label} SSE timeout`)), 7000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stream) stream.destroy();
      if (error) reject(error); else resolve(result);
    }

    function consume(chunk) {
      buffer += chunk.toString('utf8');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const line = frame.split('\n').find((row) => row.startsWith('data: '));
        if (!line) continue;
        let data;
        try { data = JSON.parse(line.slice(6)); } catch (_) { continue; }
        if (!ready && data.type === 'ready') {
          ready = true;
          resolveReady();
        } else if (ready && eventPredicate(data)) {
          resolveEvent(data);
        }
      }
    }

    stream = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    }, async (res) => {
      try {
        assert.strictEqual(res.statusCode, 200, `${label} status=${res.statusCode}`);
        assert.match(String(res.headers['content-type'] || ''), /text\/event-stream/, `${label} content type`);
        res.on('data', consume);
        await Promise.race([readyPromise, new Promise((_, rejectReady) => setTimeout(() => rejectReady(new Error(`${label} ready timeout`)), 5000))]);
        const posted = await request('/api/metrics', { method: 'POST', body: payload });
        assert.strictEqual(posted.status, 200, `${label} trigger status=${posted.status}`);
        const event = await Promise.race([eventPromise, new Promise((_, rejectEvent) => setTimeout(() => rejectEvent(new Error(`${label} event timeout`)), 5000))]);
        finish(null, event);
      } catch (error) {
        finish(error);
      }
    });
    stream.on('error', (error) => { if (!settled && error.code !== 'ECONNRESET') finish(error); });
    stream.end();
  });
}

async function main() {
  const metric = await waitForStream(
    '/api/metrics/stream',
    { metric: 'api-call', value: 17, unit: 'ms', page: '/sse-gate' },
    (data) => data.metric === 'api-call' && data.value === 17,
    'metrics',
  );
  console.log(`SSE_METRIC_PASS metric=${metric.metric} value=${metric.value}`);

  const alert = await waitForStream(
    '/api/alerts/stream',
    { metric: 'api-call', value: 2400, unit: 'ms', page: '/sse-alert-gate' },
    (data) => data.type === 'performance' && data.metric === 'api-call' && data.value === 2400,
    'alerts',
  );
  console.log(`SSE_ALERT_PASS severity=${alert.severity} value=${alert.value}`);
  console.log(`sse-contract: PASS base=${base}`);
}

main().catch((error) => {
  console.error(`SSE_CONTRACT_FAIL ${error.message}`);
  process.exitCode = 1;
});
