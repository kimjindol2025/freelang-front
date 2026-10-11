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

function post(pathname, port, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'POST', headers }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
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
  const devServer = fs.readFileSync(path.join(temp, 'dev-server.js'), 'utf8');
  if (!layout.includes("type==='css-reload'") || !layout.includes("type==='soft-reload'")
    || !layout.includes('location.reload()')
    || !layout.includes('isExpectedTransitionCancel')
    || !layout.includes('function primaryLocation')
    || !devServer.includes('fl-front-realtime-diagnostics/1')
    || !devServer.includes('setTimeout(() => rebuild(full), 250)')
    || !server.includes('(fl-env-get "FL_DEV")')) {
    throw new Error('HMR/diagnostics contract or FL_DEV guard is missing');
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
  const buildState = JSON.parse(fs.readFileSync(path.join(temp, '.build-state.json'), 'utf8'));
  const generatedLine = Number(Object.keys(buildState.sourceMapLines || {})[0]);
  const browserError = await post('/~errors', HMR_PORT, JSON.stringify({
    type: 'error',
    message: 'source-map contract probe',
    source: '_app.fl',
    line: generatedLine,
    col: 7,
    stack: `Error: source-map contract probe\n    at _app.fl:${generatedLine}:7`,
  }), {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify({
      type: 'error',
      message: 'source-map contract probe',
      source: '_app.fl',
      line: generatedLine,
      col: 7,
      stack: `Error: source-map contract probe\n    at _app.fl:${generatedLine}:7`,
    })),
  });
  const browserErrors = await get('/~errors', HMR_PORT);
  const latestBrowserError = JSON.parse(browserErrors.body)[0];
  if (browserError.status !== 200
    || latestBrowserError?.source_location?.file !== buildState.sourceMapLines[String(generatedLine)].file
    || latestBrowserError?.generated_location?.line !== generatedLine) {
    throw new Error(`browser error source map failed: ${browserError.status} ${browserErrors.body}`);
  }
  const sourceView = await get(`/~ai/source?file=_app.fl&line=${generatedLine}`, HMR_PORT);
  if (sourceView.status !== 200 || !sourceView.body.includes(buildState.sourceMapLines[String(generatedLine)].file)) {
    throw new Error(`source viewer mapping failed: ${sourceView.status} ${sourceView.body.slice(0, 240)}`);
  }
  const sourceJson = await get(`/~ai/source?file=_app.fl&line=${generatedLine}&col=7&format=json`, HMR_PORT);
  const sourceContext = JSON.parse(sourceJson.body);
  if (sourceJson.status !== 200
    || sourceContext.schema !== 'fl-front-source-context/1'
    || sourceContext.source?.file !== buildState.sourceMapLines[String(generatedLine)].file
    || sourceContext.generated?.line !== generatedLine
    || !sourceContext.context?.some((item) => item.focus === true)
    || sourceContext.evidence?.command !== 'node fl-front-build.js --json') {
    throw new Error(`AI source context failed: ${sourceJson.status} ${sourceJson.body.slice(0, 400)}`);
  }
  const sourceTraversal = await get('/~ai/source?file=pages/../server.fl&line=1', HMR_PORT);
  const sourceMissing = await get('/~ai/source?file=pages/does-not-exist.flx&line=1', HMR_PORT);
  if (sourceTraversal.status !== 400 || sourceMissing.status !== 404) {
    throw new Error(`source viewer boundary failed: traversal=${sourceTraversal.status} missing=${sourceMissing.status}`);
  }
  const traversal = await get('/~ai/test?file=../../etc/passwd', HMR_PORT);
  if (traversal.status !== 200 || !traversal.body.includes('pages 내부의 .flx')) {
    throw new Error(`AI test path boundary failed: ${traversal.status} ${traversal.body}`);
  }
  const functions = await get('/~ai/fns', HMR_PORT);
  const functionNames = JSON.parse(functions.body).fns.map((fn) => fn.name);
  if (!functionNames.includes('front-collection-memory?')) {
    throw new Error('AI function inventory omitted predicate function names');
  }
  const playground = await post('/api/playground/eval', APP_PORT, JSON.stringify({ code: '(+ 1 2)' }), {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify({ code: '(+ 1 2)' })),
  });
  if (playground.status !== 403) {
    throw new Error(`playground auth boundary failed: ${playground.status} ${playground.body}`);
  }
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
  const diagnosticsResponse = await get('/~ai/diagnostics', HMR_PORT);
  const diagnostics = JSON.parse(diagnosticsResponse.body);
  if (diagnosticsResponse.status !== 200
    || diagnostics.schema !== 'fl-front-realtime-diagnostics/1'
    || diagnostics.last_good_build?.ok !== true
    || diagnostics.last_good_build?.routes < 1
    || diagnostics.hmr?.type !== 'build-error'
    || diagnostics.hmr?.source !== 'pages/index.flx') {
    throw new Error(`realtime diagnostics failed: ${diagnosticsResponse.status} ${diagnosticsResponse.body.slice(0, 500)}`);
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
