#!/usr/bin/env node
/**
 * FreeLang Front internal production performance contract.
 * The harness owns and stops only the temporary runtime it starts.
 */
'use strict';

const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = process.env.FREELANG_AFJ_RUNNER || path.join(ROOT, 'runtime', 'bootstrap.js');
const PORT = Number(process.env.FL_PERF_PORT || 47800 + Math.floor(Math.random() * 150));
const N = Number(process.env.FL_PERF_N || 20);
const WARM = Number(process.env.FL_PERF_WARM || 3);
const TIMEOUT_MS = Number(process.env.FL_PERF_TIMEOUT_MS || 15000);
const children = [];

const ROUTES = ['/api/hello', '/about', '/people', '/dashboard'];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function start() {
  const child = spawn(process.execPath, [RUNNER, 'run', 'server.fl'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), FL_HTTP_ALLOW: '127.0.0.1,localhost', FL_FRONT_COLLECTION_ADAPTER: 'memory' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.logs = '';
  child.stdout.on('data', chunk => { child.logs += String(chunk); });
  child.stderr.on('data', chunk => { child.logs += String(chunk); });
  children.push(child);
}

async function request(route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}${route}`, { signal: controller.signal });
    const body = await response.arrayBuffer();
    return { status: response.status, ms: performance.now() - started, bytes: body.byteLength };
  } finally {
    clearTimeout(timer);
  }
}

async function waitReady() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if ((await request('/api/hello')).status === 200) return;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error(`server did not become ready on ${PORT}`);
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  return { n: sorted.length, p50: +q(0.50).toFixed(2), p95: +q(0.95).toFixed(2), max: +q(1).toFixed(2) };
}

function rssKb() {
  const child = children[0];
  if (!child || child.exitCode !== null) return null;
  const result = require('node:child_process').spawnSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' });
  const value = Number(result.stdout.trim());
  return Number.isFinite(value) ? value : null;
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  await new Promise(resolve => {
    const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGTERM'); resolve(); }, 2000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  const routeResults = {};
  try {
    start();
    await waitReady();
    for (const route of ROUTES) {
      for (let i = 0; i < WARM; i++) await request(route);
      const samples = [];
      let last = null;
      for (let i = 0; i < N; i++) { last = await request(route); samples.push(last.ms); }
      routeResults[route] = { ...stats(samples), status: last.status, bytes: last.bytes };
    }
    const concurrent = [];
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      const responses = await Promise.all(Array.from({ length: 20 }, () => request('/api/hello')));
      concurrent.push({ elapsed_ms: performance.now() - started, all_200: responses.every(r => r.status === 200) });
    }
    const rss = rssKb();
    const checks = {
      api_p95_under_50ms: routeResults['/api/hello'].p95 <= 50,
      ssr_p95_under_120ms: ['/about', '/people', '/dashboard'].every(route => routeResults[route].p95 <= 120),
      parallel_20_all_200: concurrent.every(batch => batch.all_200),
      parallel_20_p95_under_400ms: stats(concurrent.map(batch => batch.elapsed_ms)).p95 <= 400,
      rss_under_512mb: rss !== null && rss <= 512 * 1024,
    };
    const pass = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({
      schema: 'fl-front-performance/1', pass, port: PORT, n: N, warm: WARM,
      routes: routeResults,
      concurrency: { parallel: 20, batches: concurrent.length, elapsed: stats(concurrent.map(batch => batch.elapsed_ms)), all_200: concurrent.every(batch => batch.all_200) },
      process_rss_kb: rss,
      thresholds: { api_p95_ms: 50, ssr_p95_ms: 120, parallel_20_p95_ms: 400, rss_kb: 512 * 1024 },
      checks,
    }));
    process.exitCode = pass ? 0 : 2;
  } catch (error) {
    console.log(JSON.stringify({ schema: 'fl-front-performance/1', pass: false, port: PORT, error: error.message, logs: children.map(child => child.logs.slice(-1200)) }));
    process.exitCode = 2;
  } finally {
    await Promise.all(children.map(stop));
  }
}

main();
