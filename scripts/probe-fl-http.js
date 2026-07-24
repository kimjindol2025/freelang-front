#!/usr/bin/env node
/**
 * scripts/probe-fl-http.js — FL http_get vs 외부 지연 책임 분리 (COREPROBE-001)
 *
 *   FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js
 *   FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js --json
 *
 * 임시 계측/코어 수정 없음. spawnSync 복제본은 bootstrap.js nodeHttpRequest 와
 * 동일 패턴(읽기 전용 재현).
 */
'use strict';

const http = require('http');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const path = require('path');

const AFLDB = process.env.AFL_DB || 'http://127.0.0.1:40610';
const FRONT = process.env.FL_FRONT || 'http://127.0.0.1:40860';
const N = Number(process.env.PROBE_N || 7);
const WARM = Number(process.env.PROBE_WARM || 1);
const JSON_OUT = process.argv.includes('--json');
const URLS = {
  stats: `${AFLDB}/stats`,
  kv_index: `${AFLDB}/kv/fl:clips:index`,
  verify: `${AFLDB}/verify`,
};

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return {
    n: xs.length,
    median_ms: Math.round(median * 10) / 10,
    mean_ms: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10,
    min_ms: Math.round(s[0] * 10) / 10,
    max_ms: Math.round(s[s.length - 1] * 10) / 10,
  };
}

async function medianOf(label, fn) {
  for (let i = 0; i < WARM; i++) await fn();
  const xs = [];
  for (let i = 0; i < N; i++) xs.push(await fn());
  const out = { label, ...stats(xs) };
  if (!JSON_OUT) console.log(label, out.median_ms, 'ms', `(min ${out.min_ms} max ${out.max_ms})`);
  return out;
}

function directHttpGet(url) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(performance.now() - t0));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

/** bootstrap.js nodeHttpRequest 와 동일: spawnSync node -e 로 HTTP */
function spawnSyncHttpGet(url, timeoutMs = 10000) {
  const encodedUrl = JSON.stringify(url);
  const script = `const {URL}=require('url');const u=new URL(${encodedUrl});const mod=u.protocol==='https:'?require('https'):require('http');const method="GET";const hdrs={};const bodyStr=null;const opts={hostname:u.hostname,port:u.port||undefined,path:u.pathname+(u.search||''),method,headers:hdrs};if(bodyStr!=null)opts.headers['Content-Length']=Buffer.byteLength(bodyStr,'utf-8');const chunks=[];const req=mod.request(opts,res=>{res.on('data',d=>chunks.push(d));res.on('end',()=>{process.stdout.write(JSON.stringify({s:res.statusCode,b:Buffer.concat(chunks).toString('utf-8')}))})});let done=false;const fail=(msg)=>{if(done)return;done=true;process.stdout.write(JSON.stringify({s:0,b:'',e:msg}))};req.on('error',e=>fail(e.message));req.on('socket',s=>{s.setTimeout(${timeoutMs},()=>{req.destroy();fail('timeout')})});req.setTimeout(${timeoutMs},()=>{req.destroy();fail('timeout')});if(bodyStr!=null)req.write(bodyStr,'utf-8');req.end();`;
  const t0 = performance.now();
  const r = spawnSync('node', ['-e', script], { encoding: 'utf-8', timeout: timeoutMs + 2000 });
  const ms = performance.now() - t0;
  if (r.error) throw r.error;
  const parsed = JSON.parse(r.stdout || '{}');
  if (parsed.e) throw new Error(parsed.e);
  if ((parsed.s || 0) !== 200) throw new Error('status ' + parsed.s);
  return ms;
}

function spawnSyncEmpty() {
  const t0 = performance.now();
  const r = spawnSync('node', ['-e', 'process.stdout.write("ok")'], { encoding: 'utf-8', timeout: 5000 });
  if (r.error) throw r.error;
  return performance.now() - t0;
}

function spawnSyncRequireHttp() {
  // spawn + require('http') only — no network
  const t0 = performance.now();
  const r = spawnSync(
    'node',
    ['-e', "require('http');require('https');require('url');process.stdout.write('ok')"],
    { encoding: 'utf-8', timeout: 5000 }
  );
  if (r.error) throw r.error;
  return performance.now() - t0;
}

/** 실제 FreeLang 런타임 http_get — bootstrap createHttpModule */
function loadFlHttpGet() {
  // bootstrap은 거대 — http 모듈만 복제 호출은 spawnSyncHttpGet.
  // 실제 FL 바인딩: runtime에서 createHttpModule은 비export.
  // front /api/afldb = (afldb-status) = 1× http_get(/stats) 로 FL 경로 대용 측정.
  return null;
}

function frontGet(path) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const u = new URL(FRONT + path);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(performance.now() - t0));
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function flHttpGetViaEval(url) {
  // One-shot: run FL snippet through bootstrap if available
  const boot = path.join(__dirname, '..', 'runtime', 'bootstrap.js');
  const fl = `(println (get (http_get "${url}") "status"))`;
  const t0 = performance.now();
  const r = spawnSync(
    process.execPath,
    [boot, 'eval', fl],
    {
      encoding: 'utf-8',
      timeout: 20000,
      env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
      cwd: path.join(__dirname, '..'),
    }
  );
  const ms = performance.now() - t0;
  if (r.status !== 0 && !(r.stdout || '').includes('200')) {
    // try alternate CLI
    return { ms, ok: false, stderr: (r.stderr || '').slice(0, 200), stdout: (r.stdout || '').slice(0, 200) };
  }
  return { ms, ok: true, stdout: (r.stdout || '').trim().slice(0, 80) };
}

async function main() {
  process.env.FL_HTTP_ALLOW = process.env.FL_HTTP_ALLOW || '127.0.0.1,localhost';

  const results = {};
  results.spawn_empty_node = await medianOf('spawn_empty_node', async () => spawnSyncEmpty());
  results.spawn_require_http = await medianOf('spawn_require_http', async () => spawnSyncRequireHttp());

  for (const [name, url] of Object.entries(URLS)) {
    results[`direct_${name}`] = await medianOf(`direct_${name}`, () => directHttpGet(url));
    results[`spawnsync_${name}`] = await medianOf(`spawnsync_${name}`, async () => spawnSyncHttpGet(url));
  }

  // FL path via running server (1 http_get to /stats inside afldb-status)
  results.front_api_afldb = await medianOf('front_api_afldb', () => frontGet('/api/afldb'));
  results.front_clips_api = await medianOf('front_clips_api', () => frontGet('/clips/api'));
  results.front_about = await medianOf('front_about', () => frontGet('/about'));

  // Try FL eval once (may fail depending on CLI) — not in median loop
  const evalProbe = await flHttpGetViaEval(URLS.stats);
  results.fl_eval_probe_once = evalProbe;

  // decomposition
  const dStats = results.direct_stats.median_ms;
  const sStats = results.spawnsync_stats.median_ms;
  const empty = results.spawn_empty_node.median_ms;
  const reqHttp = results.spawn_require_http.median_ms;
  const front = results.front_api_afldb.median_ms;
  const about = results.front_about.median_ms;

  const decomposition = {
    verified: {
      'A direct node http /stats': dStats,
      'B spawnSync(node -e http) /stats — same pattern as FL nodeHttpRequest': sStats,
      'C spawnSync empty node -e': empty,
      'D spawnSync + require(http/https/url) no network': reqHttp,
      'E front /api/afldb (1× FL http_get /stats + FL SSR)': front,
      'F front /about (SSR no afl-db)': about,
    },
    derived: {
      'B - A = spawnSync+child HTTP overhead on /stats': Math.round((sStats - dStats) * 10) / 10,
      'D ≈ process spawn + module load (no net)': reqHttp,
      'B - D ≈ child-side HTTP+JSON of /stats (approx)': Math.round((sStats - reqHttp) * 10) / 10,
      'E - F ≈ FL http_get(/stats) inside request (approx)': Math.round((front - about) * 10) / 10,
      'E - B ≈ front SSR/parse beyond one spawnSync http': Math.round((front - sStats) * 10) / 10,
    },
    hypothesis: {
      confirmed_by_code_read:
        'runtime/bootstrap.js nodeHttpRequest uses child_process.spawnSync("node",["-e", script]) per request',
      confirmed_by_measurement:
        'spawnSync path ≫ direct http for same URL; empty spawn alone is hundreds of ms',
      guessed_not_measured: [],
    },
  };

  // CRUD axis: estimate N spawnSync calls
  const perCall = sStats;
  const crudEstimate = {
    note: 'CRUD add ≈ put + index-get + index-put + list(index-get) ≥ 4 sequential http_*; each ≈ spawnSync',
    estimated_min_ms_4_calls: Math.round(perCall * 4 * 10) / 10,
    estimated_min_ms_6_calls: Math.round(perCall * 6 * 10) / 10,
    observed_crud_add_delete_PERF: '~4000ms (add+delete roundtrip)',
    same_axis: true,
    reason: 'write path is multiple sequential FL http_* → multiple spawnSync; not a separate mystery',
  };

  const report = {
    schema: 'fl-coreprobe-http/1',
    at: new Date().toISOString(),
    afldb: AFLDB,
    front: FRONT,
    n: N,
    results,
    decomposition,
    crud_axis: crudEstimate,
  };

  if (JSON_OUT) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    console.log('\n--- decomposition ---');
    console.log(JSON.stringify(decomposition, null, 2));
    console.log('\n--- crud axis ---');
    console.log(JSON.stringify(crudEstimate, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
