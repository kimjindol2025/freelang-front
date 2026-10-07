#!/usr/bin/env node
/**
 * scripts/perf-afldb.js — afl-db/SSR 지연 재현 측정 (RUN-FL-PERF-001)
 *
 *   node scripts/perf-afldb.js
 *   node scripts/perf-afldb.js --json
 *
 * 부하/픽스처 데이터를 만들지 않는다. 기존 서비스(:40860/:40610)만 읽는다.
 * CRUD 프로브는 add 직후 같은 content로 delete — 잔여 0.
 * AFJ-DB v1 보호 경로는 AFLDB_ADMIN_KEY 또는 AFLDB_KEY를 사용한다.
 */
'use strict';

const http = require('http');
const { performance } = require('perf_hooks');

const FRONT = process.env.FL_FRONT || 'http://127.0.0.1:40860';
const AFLDB = process.env.AFL_DB || 'http://127.0.0.1:40610';
const AFLDB_KEY = process.env.AFLDB_ADMIN_KEY || process.env.AFLDB_KEY || process.env.AFLDB_API_KEY || '';
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
          const ms = performance.now() - t0;
          // 429 등 비정상은 ms가 수 ms로 나와 median을 오염시킴 — 실패로 올려 재시도/중단
          const allowStatusCodes = Array.isArray(opts.allowStatusCodes) ? opts.allowStatusCodes : [];
          if (res.statusCode >= 400 && !allowStatusCodes.includes(res.statusCode)) {
            reject(new Error(`HTTP ${res.statusCode} ${opts.method || 'GET'} ${path} (${Math.round(ms)}ms)`));
            return;
          }
          resolve({
            ms,
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

function afldbTimed(path, key = AFLDB_KEY, allowStatusCodes = []) {
  const headers = key ? { Authorization: `Bearer ${key}` } : {};
  return timed(`${AFLDB}${path}`, { headers, allowStatusCodes });
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
  results.afldb_stats = await medianOf('afldb_stats', () => afldbTimed('/v1/stats'));
  results.afldb_verify = await medianOf('afldb_verify', () => afldbTimed('/v1/verify'));
  // 키가 없으면 404가 정상적인 저장소 상태다. 라우팅/인증 지연은 측정하되
  // “키 없음”을 AFJ-DB 장애로 오판하지 않도록 허용 상태로 기록한다.
  results.afldb_kv_clips_index = await medianOf('afldb_kv_clips_index', () => afldbTimed('/v1/kv/fl:clips:index', AFLDB_KEY, [404]));
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
      // 정적 콜 횟수 (afl-db HTTP). create는 batch-put 적용 후 기준.
      http_calls: {
        coll_create: 2, // index-get + batch-put(item,index)  — was 3
        coll_update: 2, // get + put (read-then-write; batch 불가)
        coll_delete: 3, // index-get + index-put + delete (batch-delete 없음)
        clips_add: 2, // = coll_create
        clips_delete: 3, // = coll_delete
        clips_add_delete_roundtrip: 5, // was 6
      },
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
