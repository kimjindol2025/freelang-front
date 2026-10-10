#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP_PORT = 46100 + Math.floor(Math.random() * 400);
const HMR_PORT = 46800 + Math.floor(Math.random() * 400);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-front-hmr-'));
let child = null;
let hmrResponse = null;
let hmrRequest = null;
let hmrEvents = [];
let childLogs = '';

function copyWorkspace() {
  fs.cpSync(ROOT, temp, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(ROOT, source);
      return relative !== '.git'
        && !relative.startsWith(`.git${path.sep}`)
        && relative !== 'node_modules'
        && !relative.startsWith(`node_modules${path.sep}`)
        && relative !== 'data'
        && !relative.startsWith(`data${path.sep}`)
        && relative !== '.build-state.json'
        && relative !== 'AGENTS.md';
    },
  });
  const serverPath = path.join(temp, 'server.fl');
  const server = fs.readFileSync(serverPath, 'utf8');
  fs.writeFileSync(serverPath, server.replace('(define PORT 40860)', `(define PORT ${APP_PORT})`));
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function get(pathname, port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: pathname, timeout: 1000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
  });
}

async function waitForHttp(pathname, port, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await get(pathname, port);
      if (result.status && result.status < 500) return result;
    } catch (_) {}
    await wait(100);
  }
  throw new Error(`HTTP server did not become ready: ${port}${pathname}`);
}

function connectHmr() {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: HMR_PORT, path: '/~hmr', timeout: 3000 }, (res) => {
      hmrRequest = req;
      hmrResponse = res;
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const match = part.match(/data:\s*([^\n]+)/);
          if (match) hmrEvents.push(match[1].trim());
        }
      });
      resolve();
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HMR SSE timeout')));
  });
}

async function waitForEvent(event, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (hmrEvents.includes(event)) return;
    await wait(100);
  }
  throw new Error(`HMR event not observed: ${event}; events=${hmrEvents.join(',')}`);
}

async function waitForState(timeout = 20000, minVersion = 1) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const result = await get('/~hmr-state?since=0', APP_PORT);
      try {
        const state = JSON.parse(result.body);
        last = `${result.status} ${result.body}`;
        if (result.status === 200 && ['css-reload', 'soft-reload', 'build-error'].includes(state.type)
          && typeof state.version === 'number' && state.version >= minVersion) {
          return { result, state };
        }
      } catch (_) {}
    } catch (error) {
      last = error.message;
      }
    await wait(100);
  }
  throw new Error(`same-origin HMR state did not settle: ${last}`);
}

async function main() {
  copyWorkspace();
  const layout = fs.readFileSync(path.join(temp, 'pages/_layout.flx'), 'utf8');
  const server = fs.readFileSync(path.join(temp, 'server.fl'), 'utf8');
  if (!layout.includes("type==='css-reload'") || !layout.includes("type==='soft-reload'")
    || !layout.includes('location.reload()') || !server.includes('(fl-env-get "FL_DEV")')) {
    throw new Error('HMR L1/L2/L3 or FL_DEV guard is missing');
  }

  child = spawn(process.execPath, ['dev-server.js'], {
    cwd: temp,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HMR_PORT: String(HMR_PORT),
      FL_HTTP_ALLOW: '127.0.0.1,localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { childLogs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { childLogs += chunk.toString(); });

  await waitForHttp('/', APP_PORT);
  await connectHmr();
  await wait(200);

  const cssPath = path.join(temp, 'public/app.css');
  fs.appendFileSync(cssPath, '\n/* hmr-contract-css */\n');
  const { state: cssState } = await waitForState(20000, 1);
  if (cssState.type !== 'css-reload') {
    throw new Error(`same-origin HMR state did not report css-reload: ${JSON.stringify(cssState)}`);
  }
  await wait(1200);

  const logicPath = path.join(temp, 'pages/index.flx');
  fs.appendFileSync(logicPath, '\n(define hmr_contract_probe 1)\n');
  await wait(5000);
  const { state: stateJson } = await waitForState(30000, 2);
  if (stateJson.type !== 'soft-reload') {
    throw new Error(`same-origin HMR state did not report soft-reload: ${JSON.stringify(stateJson)}`);
  }

  fs.appendFileSync(logicPath, '\n(define hmr_contract_broken\n');
  const { state: errorState } = await waitForState(30000, 3);
  if (errorState.type !== 'build-error' || !errorState.message) {
    throw new Error(`same-origin HMR state did not report build-error: ${JSON.stringify(errorState)}`);
  }
  console.log(JSON.stringify({
    schema: 'fl-front-hmr-contract/1',
    pass: true,
    app_port: APP_PORT,
    hmr_port: HMR_PORT,
    events: hmrEvents,
    state: stateJson,
    error: errorState,
    levels: ['L1-reload', 'L2-css-reload', 'L3-soft-reload'],
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    schema: 'fl-front-hmr-contract/1',
    pass: false,
    message: error.message,
    server_log: `${childLogs.split('\n').filter((line) => line.includes('[hmr] state')).join('\n')}\n${childLogs.slice(-2500)}`,
  }));
  process.exitCode = 1;
}).finally(() => {
  if (hmrResponse) hmrResponse.destroy();
  if (hmrRequest) hmrRequest.destroy();
  if (child && !child.killed) child.kill('SIGINT');
  try {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  } catch (cleanupError) {
    console.error(JSON.stringify({ cleanup: 'BLOCKED', path: temp, message: cleanupError.message }));
  }
});
