#!/usr/bin/env node
/**
 * scripts/perf-afldb.js — afl-db/SSR 지연 재현 측정 (RUN-FL-PERF-001)
 *
 *   node scripts/perf-afldb.js
 *   node scripts/perf-afldb.js --json
 *
 * 부하/픽스처 데이터를 만들지 않는다. 기존 서비스(:40860/:40610)만 읽는다.
 * CRUD 프로브는 add 직후 같은 content로 delete — 잔여 0.
 */
'use strict';

const http = require('http');
const { performance } = require('perf_hooks');

const FRONT = process.env.FL_FRONT || 'http://127.0.0.1:40860';
const AFLDB = process.env.AFL_DB || 'http://127.0.0.1:40610';
const N = Number(process.env.PERF_N || 5);
const WARM = Number(process.env.PERF_WARM || 1);
const JSON_OUT = process.argv.includes('--json');

function parseUrl(u) {
  const x = new URL(u);
  return { hostname: x.hostname, port: x.port || (x.protocol === 'https:' ? 443 : 80), path: x.pathname + x.search };
}

function timed(url, opts = {}) {
  const { hostname, port, path } = parseUrl(url);
  const body = opts.body != null ? Buffer.from(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
  const headers = Object.assign({}, opts.headers || {});
  if (body) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  headers['Content-Length'] = body ? body.length : 0;
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = http.request(
      { hostname, port, path, method: opts.method || (body ? 'POST' : 'GET'), headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ms: performance.now() - t0,
            status: res.statusCode,
            bytes: buf.length,
            body: buf,
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    n: xs.length,
    median_ms: Math.round(median * 10) / 10,
    mean_ms: Math.round(mean * 10) / 10,
    min_ms: Math.round(s[0] * 10) / 10,
    max_ms: Math.round(s[s.length - 1] * 10) / 10,
  };
}

async function medianOf(label, fn) {
  for (let i = 0; i < WARM; i++) await fn();
  const xs = [];
  for (let i = 0; i < N; i++) {
    const r = await fn();
    xs.push(typeof r === 'number' ? r : r.ms);
  }
  const out = { label, ...stats(xs) };
  if (!JSON_OUT) console.log(label, out);
  return out;
}

async function crudAddDelete() {
  const content = `perf-probe-${Date.now()}`;
  const t0 = performance.now();
  const add = await timed(`${FRONT}/clips/api`, { body: { action: 'add', content } });
  const j = JSON.parse(add.body.toString('utf8'));
  const items = j.items || [];
  let id = null;
  for (const it of items) {
    if (it && String(it.content || '') === content) id = it.id;
  }
  if (id == null && items.length) id = items[items.length - 1].id;
  if (id != null) await timed(`${FRONT}/clips/api`, { body: { action: 'delete', id: String(id) } });
  return performance.now() - t0;
}

async function main() {
  const results = {};
  results.front_home = await medianOf('front_home', () => timed(`${FRONT}/`));
  results.front_about = await medianOf('front_about', () => timed(`${FRONT}/about`));
  results.front_clips_html = await medianOf('front_clips_html', () => timed(`${FRONT}/clips`));
  results.front_clips_api = await medianOf('front_clips_api', () => timed(`${FRONT}/clips/api`));
  results.front_api_afldb = await medianOf('front_api_afldb', () => timed(`${FRONT}/api/afldb`));
  results.afldb_stats = await medianOf('afldb_stats', () => timed(`${AFLDB}/stats`));
  results.afldb_verify = await medianOf('afldb_verify', () => timed(`${AFLDB}/verify`));
  results.afldb_kv_clips_index = await medianOf('afldb_kv_clips_index', () => timed(`${AFLDB}/kv/fl:clips:index`));
  results.front_clips_crud_add_delete = await medianOf('front_clips_crud_add_delete', crudAddDelete);

  const report = {
    schema: 'fl-perf-afldb/1',
    at: new Date().toISOString(),
    front: FRONT,
    afldb: AFLDB,
    n: N,
    warm: WARM,
    results,
    composition_hint: {
      clips_api_total: results.front_clips_api.median_ms,
      api_afldb_status: results.front_api_afldb.median_ms,
      afldb_verify_direct: results.afldb_verify.median_ms,
      afldb_stats_direct: results.afldb_stats.median_ms,
      clips_html: results.front_clips_html.median_ms,
      about_ssr_baseline: results.front_about.median_ms,
    },
  };

  if (JSON_OUT) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    console.log('\ncomposition_hint', report.composition_hint);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
