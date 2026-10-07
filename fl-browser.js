#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { setTimeout: sleep } = require('timers/promises');

const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, '.browser-state.json');
const DEFAULT_BROWSER_URL = process.env.FL_BROWSER_DEBUG_URL || 'http://127.0.0.1:9222';
const DEFAULT_PROFILE_DIR = process.env.FL_BROWSER_PROFILE_DIR || path.join(ROOT, '.browser-profile');
const DEFAULT_TIMEOUT_MS = Number(process.env.FL_BROWSER_TIMEOUT_MS || '15000');
const LOG_LIMIT = 100;

function usage() {
  process.stdout.write(`FreeLang browser observability\n\n` +
    `Usage:\n` +
    `  node fl-browser.js start [--executable PATH] [--browser-url URL] [--url URL]\n` +
    `  node fl-browser.js attach [active|--url URL|--title TITLE|--target-id ID]\n` +
    `  node fl-browser.js watch active [--reload]\n` +
    `  node fl-browser.js check active [--goto URL] [--reload] [--selector CSS] [--click CSS] [--fill CSS=TEXT] [--screenshot PATH]\n` +
    `  node fl-browser.js logs active\n` +
    `  node fl-browser.js screenshot active [--output PATH]\n` +
    `  node fl-browser.js status\n` +
    `\n` +
    `State file: ${STATE_FILE}\n`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      if (out[key] === undefined) out[key] = next;
      else if (Array.isArray(out[key])) out[key].push(next);
      else out[key] = [out[key], next];
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function print(obj, jsonMode) {
  if (jsonMode) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  } else if (typeof obj === 'string') {
    process.stdout.write(obj + '\n');
  } else {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  }
}

function nowIso() {
  return new Date().toISOString();
}

function shortText(value, max = 120) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function expectedNetworkNoise(status, url, errorText) {
  const target = String(url || '');
  const error = String(errorText || '');
  return (Number(status) === 404 && target.includes('/~hmr-state'))
    || error.includes('ERR_ABORTED');
}

function normalizeRouteOrUrl(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('ws://') || value.startsWith('wss://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return value;
  }
  return `/${value}`;
}

function routeMatches(targetUrl, needle) {
  if (!needle) return true;
  const n = normalizeRouteOrUrl(needle);
  if (!targetUrl) return false;
  if (n.startsWith('http://') || n.startsWith('https://')) return targetUrl === n;
  try {
    const u = new URL(targetUrl);
    return u.pathname === n || targetUrl.includes(n);
  } catch {
    return targetUrl.includes(n);
  }
}

function findCandidateBrowserExecutable(explicit) {
  const candidates = [
    explicit,
    process.env.FL_BROWSER_EXECUTABLE,
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  return candidates[0] || '';
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function listTargets(browserUrl) {
  return fetchJson(`${browserUrl}/json/list`);
}

async function getVersion(browserUrl) {
  return fetchJson(`${browserUrl}/json/version`);
}

async function waitForBrowserEndpoint(browserUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await getVersion(browserUrl);
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`CDP endpoint unavailable: ${browserUrl}`);
}

async function launchBrowser(opts) {
  const executable = findCandidateBrowserExecutable(opts.executable);
  if (!executable) {
    throw new Error('browser executable not found. Set FL_BROWSER_EXECUTABLE or pass --executable.');
  }

  const browserUrl = opts['browser-url'] || DEFAULT_BROWSER_URL;
  const port = new URL(browserUrl).port || '9222';
  const profileDir = opts['profile-dir'] || DEFAULT_PROFILE_DIR;
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    '--disable-popup-blocking',
  ];
  if (opts.headless) args.push('--headless=new');
  if (opts.url) args.push(normalizeRouteOrUrl(opts.url));

  const child = cp.spawn(executable, args, {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => process.stderr.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  child.unref();

  await waitForBrowserEndpoint(browserUrl, Number(opts.timeout || DEFAULT_TIMEOUT_MS));
  return { executable, browserUrl, profileDir };
}

function createCdpSession(wsUrl, handlers = {}) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  let closed = false;

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', ev => {
    const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
    const msg = JSON.parse(raw);
    if (msg.id) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error.message || `CDP error for ${entry.method}`));
      else entry.resolve(msg.result || {});
      return;
    }
    if (msg.method && handlers[msg.method]) {
      handlers[msg.method](msg.params || {}, msg);
    }
  });

  ws.addEventListener('close', () => {
    closed = true;
    for (const { reject } of pending.values()) reject(new Error('CDP websocket closed'));
    pending.clear();
  });

  async function call(method, params = {}) {
    await ready;
    if (closed) throw new Error('CDP websocket already closed');
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function close() {
    try { ws.close(); } catch {}
  }

  return { ready, call, close, handlers };
}

async function resolveTarget(browserUrl, opts) {
  const targets = await listTargets(browserUrl);
  const targetId = opts['target-id'] || opts.targetId || opts.tab_id || opts.tabId;
  const title = opts.title;
  const url = opts.url;

  let target = null;
  if (targetId) target = targets.find(t => String(t.id) === String(targetId) || String(t.targetId || '') === String(targetId));
  if (!target && title) target = targets.find(t => shortText(t.title).includes(title));
  if (!target && url) target = targets.find(t => routeMatches(t.url || '', url));
  if (!target) {
    target = targets.find(t => t.type === 'page' && !t.url.startsWith('devtools://')) || null;
  }

  if (!target) {
    const err = new Error('no matching Chrome tab found');
    err.targets = targets;
    throw err;
  }
  return target;
}

function loadState() {
  return readJson(STATE_FILE, null) || null;
}

function saveState(next) {
  writeJson(STATE_FILE, next);
}

function makeTabId(target) {
  return String(target.id || target.targetId || '').trim();
}

function emptySummary() {
  return {
    target: 'tab',
    tab_id: '',
    url: '',
    load: 'FAIL',
    console_errors: 0,
    network_errors: 0,
    dom: 'FAIL',
    interactions: 'PASS',
    screenshot: 'FAIL',
    result: 'FAIL',
  };
}

async function evaluatePage(session, expression) {
  return session.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
}

async function captureSnapshot(session, selectors = []) {
  const selectorJson = JSON.stringify(selectors || []);
  const expr = `(function() {
    const selectors = ${selectorJson};
    const body = document.body;
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      hasBody: !!body,
      bodyTextLength: body ? (body.innerText || '').trim().length : 0,
      htmlLength: document.documentElement ? document.documentElement.outerHTML.length : 0,
      selectors: selectors.map(function(sel) {
        try { return !!document.querySelector(sel); } catch (e) { return false; }
      })
    };
  })()`;
  const result = await evaluatePage(session, expr);
  return result.result ? result.result.value : null;
}

async function applyInteractions(session, actions) {
  const outcomes = [];
  for (const action of actions) {
    if (!action) continue;
    if (action.type === 'click') {
      const expr = `(function() {
        const el = document.querySelector(${JSON.stringify(action.selector)});
        if (!el) return { ok:false, reason:'missing-selector' };
        el.click();
        return { ok:true };
      })()`;
      const result = await evaluatePage(session, expr);
      outcomes.push(result.result ? result.result.value : { ok: false, reason: 'no-result' });
      continue;
    }
    if (action.type === 'fill') {
      const expr = `(function() {
        const el = document.querySelector(${JSON.stringify(action.selector)});
        if (!el) return { ok:false, reason:'missing-selector' };
        const value = ${JSON.stringify(action.value)};
        el.focus();
        if ('value' in el) { el.value = value; }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok:true };
      })()`;
      const result = await evaluatePage(session, expr);
      outcomes.push(result.result ? result.result.value : { ok: false, reason: 'no-result' });
      continue;
    }
  }
  return outcomes;
}

function collectBrowserState(state, patch) {
  return {
    ...(state || {}),
    ...patch,
    updated_at: nowIso(),
  };
}

function parseInteractionArgs(argv) {
  const actions = [];
  const selectors = [];
  const clicks = Array.isArray(argv.click) ? argv.click : (argv.click ? [argv.click] : []);
  const fills = Array.isArray(argv.fill) ? argv.fill : (argv.fill ? [argv.fill] : []);
  for (const selector of clicks) actions.push({ type: 'click', selector });
  for (const fill of fills) {
    const idx = String(fill).indexOf('=');
    if (idx === -1) continue;
    actions.push({ type: 'fill', selector: fill.slice(0, idx), value: fill.slice(idx + 1) });
  }
  if (argv.selector) {
    const list = Array.isArray(argv.selector) ? argv.selector : [argv.selector];
    selectors.push(...list);
  }
  return { actions, selectors };
}

async function runCheck(session, state, argv, { watch = false } = {}) {
  const timeoutMs = Number(argv.timeout || DEFAULT_TIMEOUT_MS);
  const { actions, selectors } = parseInteractionArgs(argv);
  const errors = [];
  const networkErrors = [];
  const consoleErrors = [];
  const consoleLog = [];

  session.handlers = session.handlers || {};
  session.handlers['Runtime.consoleAPICalled'] = params => {
    const level = params.type || 'log';
    const text = (params.args || []).map(arg => shortText(arg.value ?? arg.description ?? '')).join(' ').trim();
    const entry = { level, text, time: nowIso() };
    consoleLog.unshift(entry);
    if (consoleLog.length > LOG_LIMIT) consoleLog.pop();
    if (level === 'error') consoleErrors.unshift(entry);
  };
  session.handlers['Runtime.exceptionThrown'] = params => {
    const text = shortText(params.exceptionDetails?.text || params.exceptionDetails?.exception?.description || 'exception');
    const entry = { level: 'error', text, time: nowIso() };
    consoleErrors.unshift(entry);
    consoleLog.unshift(entry);
  };
  session.handlers['Network.loadingFailed'] = params => {
    if (expectedNetworkNoise(0, '', params.errorText)) return;
    const entry = { level: 'error', text: shortText(`${params.requestId} ${params.errorText}`), time: nowIso() };
    networkErrors.unshift(entry);
    errors.unshift(entry);
  };
  session.handlers['Network.responseReceived'] = params => {
    const status = Number(params.response?.status || 0);
    if (expectedNetworkNoise(status, params.response?.url, '')) return;
    if (status >= 400) {
      const entry = { level: 'error', text: shortText(`${status} ${params.response?.url || ''}`), time: nowIso() };
      networkErrors.unshift(entry);
      errors.unshift(entry);
    }
  };

  await session.call('Runtime.enable');
  await session.call('Page.enable');
  await session.call('Network.enable');
  await session.call('Console.enable').catch(() => {});

  if (argv.goto) {
    await session.call('Page.navigate', { url: String(argv.goto) });
    await sleep(Math.min(1500, timeoutMs));
  } else if (argv.reload) {
    await session.call('Page.reload', { ignoreCache: true });
    await sleep(Math.min(1500, timeoutMs));
  } else {
    await sleep(300);
  }

  let snapshot = null;
  try {
    snapshot = await captureSnapshot(session, selectors);
  } catch (e) {
    errors.unshift({ level: 'error', text: shortText(e.message), time: nowIso() });
  }

  let interactionOutcomes = [];
  if (actions.length > 0) {
    try {
      interactionOutcomes = await applyInteractions(session, actions);
    } catch (e) {
      interactionOutcomes.push({ ok: false, reason: e.message });
    }
    await sleep(200);
    try {
      snapshot = await captureSnapshot(session, selectors);
    } catch {}
  }

  let screenshotOk = false;
  let screenshotBytes = 0;
  try {
    const shot = await session.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const data = shot.data || '';
    screenshotBytes = Buffer.from(data, 'base64').length;
    if (argv.screenshot || argv.output) {
      const outPath = path.resolve(String(argv.screenshot || argv.output));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    }
    screenshotOk = true;
  } catch (e) {
    errors.unshift({ level: 'error', text: shortText(e.message), time: nowIso() });
  }

  const loadOk = snapshot && String(snapshot.readyState || '').toLowerCase() === 'complete';
  const domOk = Boolean(snapshot && snapshot.hasBody && (selectors.length === 0 || (snapshot.selectors || []).every(Boolean)) && (snapshot.bodyTextLength >= 0));
  const interactionOk = actions.length === 0 ? true : interactionOutcomes.every(r => r && r.ok);
  const resultOk = loadOk && domOk && interactionOk && consoleErrors.length === 0 && networkErrors.length === 0 && screenshotOk;

  const browser = {
    target: 'tab',
    tab_id: state.tab_id,
    url: snapshot?.url || state.url || '',
    title: snapshot?.title || state.title || '',
    load: loadOk ? 'PASS' : 'FAIL',
    console_errors: consoleErrors.length,
    network_errors: networkErrors.length,
    dom: domOk ? 'PASS' : 'FAIL',
    interactions: interactionOk ? 'PASS' : 'FAIL',
    screenshot: screenshotOk ? 'PASS' : 'FAIL',
    result: resultOk ? 'PASS' : 'FAIL',
    ready_state: snapshot?.readyState || '',
    body_text_length: snapshot?.bodyTextLength || 0,
    screenshot_bytes: screenshotBytes,
    selectors: snapshot?.selectors || [],
  };

  const nextState = collectBrowserState(state, {
    browser,
    last_check: {
      at: nowIso(),
      browser,
      console: consoleLog.slice(0, LOG_LIMIT),
      network_errors: networkErrors,
      interactions: interactionOutcomes,
      snapshot,
      errors,
    },
    console: consoleLog.slice(0, LOG_LIMIT),
    network_errors: networkErrors,
    errors,
    status: watch ? 'watching' : 'checked',
  });

  saveState(nextState);
  return nextState;
}

async function watchTarget(session, state, argv) {
  const browserState = collectBrowserState(state, { status: 'watching' });
  const consoleLog = [];
  const networkErrors = [];
  const consoleErrors = [];
  let latestSnapshot = null;

  session.handlers = session.handlers || {};
  session.handlers['Runtime.consoleAPICalled'] = params => {
    const level = params.type || 'log';
    const text = (params.args || []).map(arg => shortText(arg.value ?? arg.description ?? '')).join(' ').trim();
    const entry = { level, text, time: nowIso() };
    consoleLog.unshift(entry);
    if (consoleLog.length > LOG_LIMIT) consoleLog.pop();
    if (level === 'error') consoleErrors.unshift(entry);
    saveState(collectBrowserState(browserState, {
      console: consoleLog.slice(0, LOG_LIMIT),
      network_errors: networkErrors,
      errors: consoleErrors,
      last_watch: {
        at: nowIso(),
        tab_id: browserState.tab_id,
        url: latestSnapshot?.url || browserState.url,
        title: latestSnapshot?.title || browserState.title,
        ready_state: latestSnapshot?.readyState || '',
        console_errors: consoleErrors.length,
        network_errors: networkErrors.length,
      },
    }));
  };
  session.handlers['Runtime.exceptionThrown'] = params => {
    const text = shortText(params.exceptionDetails?.text || params.exceptionDetails?.exception?.description || 'exception');
    const entry = { level: 'error', text, time: nowIso() };
    consoleErrors.unshift(entry);
    consoleLog.unshift(entry);
  };
  session.handlers['Network.loadingFailed'] = params => {
    if (expectedNetworkNoise(0, '', params.errorText)) return;
    const entry = { level: 'error', text: shortText(`${params.requestId} ${params.errorText}`), time: nowIso() };
    networkErrors.unshift(entry);
  };
  session.handlers['Network.responseReceived'] = params => {
    const status = Number(params.response?.status || 0);
    if (expectedNetworkNoise(status, params.response?.url, '')) return;
    if (status >= 400) {
      const entry = { level: 'error', text: shortText(`${status} ${params.response?.url || ''}`), time: nowIso() };
      networkErrors.unshift(entry);
    }
  };
  session.handlers['Page.frameNavigated'] = params => {
    browserState.url = params.frame?.url || browserState.url;
    saveState(collectBrowserState(browserState, {
      console: consoleLog.slice(0, LOG_LIMIT),
      network_errors: networkErrors,
      errors: consoleErrors,
      last_watch: {
        at: nowIso(),
        tab_id: browserState.tab_id,
        url: browserState.url,
        title: browserState.title,
        ready_state: latestSnapshot?.readyState || '',
        console_errors: consoleErrors.length,
        network_errors: networkErrors.length,
      },
    }));
  };

  await session.call('Runtime.enable');
  await session.call('Page.enable');
  await session.call('Network.enable');
  await session.call('Console.enable').catch(() => {});
  latestSnapshot = await captureSnapshot(session, []);
  saveState(collectBrowserState(browserState, {
    console: consoleLog.slice(0, LOG_LIMIT),
    network_errors: networkErrors,
    errors: consoleErrors,
    last_watch: {
      at: nowIso(),
      tab_id: browserState.tab_id,
      url: latestSnapshot?.url || browserState.url,
      title: latestSnapshot?.title || browserState.title,
      ready_state: latestSnapshot?.readyState || '',
      console_errors: consoleErrors.length,
      network_errors: networkErrors.length,
    },
  }));

  process.stdout.write(`watching tab ${browserState.tab_id} (${browserState.url})\n`);
  process.on('SIGINT', () => {
    try { saveState(collectBrowserState(browserState, { status: 'stopped' })); } catch {}
    process.exit(0);
  });

  while (true) {
    await sleep(1000);
    try {
      latestSnapshot = await captureSnapshot(session, []);
      saveState(collectBrowserState(browserState, {
        console: consoleLog.slice(0, LOG_LIMIT),
        network_errors: networkErrors,
        errors: consoleErrors,
        last_watch: {
          at: nowIso(),
          tab_id: browserState.tab_id,
          url: latestSnapshot?.url || browserState.url,
          title: latestSnapshot?.title || browserState.title,
          ready_state: latestSnapshot?.readyState || '',
          console_errors: consoleErrors.length,
          network_errors: networkErrors.length,
        },
      }));
    } catch (e) {
      saveState(collectBrowserState(browserState, {
        status: 'error',
        error: e.message,
      }));
      throw e;
    }
  }
}

async function attachCommand(argv, jsonMode) {
  const browserUrl = argv['browser-url'] || DEFAULT_BROWSER_URL;
  const target = await resolveTarget(browserUrl, argv);
  const record = collectBrowserState(loadState() || {}, {
    schema: 'fl-browser-state/1',
    browser_url: browserUrl,
    target_id: target.id,
    tab_id: makeTabId(target),
    title: target.title || '',
    url: target.url || '',
    status: 'attached',
    mode: 'active-only',
    attached_at: nowIso(),
    updated_at: nowIso(),
  });
  saveState(record);
  print({ ok: true, ...record, target }, jsonMode);
}

async function runWithCurrentTarget(argv, mode, jsonMode) {
  const state = loadState();
  if (!state || !state.target_id) {
    throw new Error('no attached browser tab. run `node fl-browser.js attach --url /path` first.');
  }
  const browserUrl = argv['browser-url'] || state.browser_url || DEFAULT_BROWSER_URL;
  const targets = await listTargets(browserUrl);
  const target = targets.find(t => String(t.id) === String(state.target_id));
  if (!target) throw new Error(`target not found: ${state.target_id}`);
  const session = createCdpSession(target.webSocketDebuggerUrl, {});
  await session.ready;
  try {
    if (mode === 'watch') {
      await watchTarget(session, state, argv);
    } else if (mode === 'screenshot') {
      const result = await runCheck(session, state, { ...argv, screenshot: argv.output || argv.screenshot || true }, { watch: false });
      print({ ok: true, ...result.last_check }, jsonMode);
    } else if (mode === 'logs') {
      print({ ok: true, ...state }, jsonMode);
    } else {
      const result = await runCheck(session, state, argv, { watch: false });
      print({ ok: true, ...result.last_check }, jsonMode);
      if (!result.last_check || result.last_check.browser?.result !== "PASS") {
        process.exitCode = 1;
      }
    }
  } finally {
    await session.close();
  }
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const cmd = argv._[0] || 'status';
  const sub = argv._[1] || '';
  const jsonMode = !!argv.json;

  if (argv.help || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    usage();
    return;
  }

  if (cmd === 'start') {
    const launched = await launchBrowser(argv);
    const state = collectBrowserState(loadState() || {}, {
      schema: 'fl-browser-state/1',
      browser_url: launched.browserUrl,
      status: 'started',
      executable: launched.executable,
      profile_dir: launched.profileDir,
      updated_at: nowIso(),
    });
    saveState(state);
    print({ ok: true, ...state }, jsonMode);
    return;
  }

  if (cmd === 'attach') {
    await attachCommand(argv, jsonMode);
    return;
  }

  if (cmd === 'status') {
    print({ ok: true, state: loadState() || {} }, jsonMode);
    return;
  }

  if (cmd === 'logs') {
    await runWithCurrentTarget(argv, 'logs', jsonMode);
    return;
  }

  if (cmd === 'screenshot') {
    await runWithCurrentTarget(argv, 'screenshot', jsonMode);
    return;
  }

  if (cmd === 'watch') {
    await runWithCurrentTarget(argv, 'watch', jsonMode);
    return;
  }

  if (cmd === 'check') {
    await runWithCurrentTarget(argv, 'check', jsonMode);
    return;
  }

  throw new Error(`unknown command: ${cmd}`);
}

main().catch(err => {
  process.stderr.write(`${err.message}\n`);
  if (err.targets) {
    process.stderr.write(JSON.stringify({ ok: false, targets: err.targets }, null, 2) + '\n');
  }
  process.exit(1);
});
