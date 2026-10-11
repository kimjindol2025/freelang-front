#!/usr/bin/env node
// dev-server.js — .flx 변경 감시 + 빌드·재시작 + HMR SSE
// Phase 5 최적화:
//   1. 서버 ready 이벤트 기반 대기 (800ms → ~250ms)
//   2. 파일 해시 캐싱 (미변경 파일 스킵)
//   3. CSS 전용 변경 감지 (빌드 스킵 + CSS만 갱신)

const fs     = require('fs');
const path   = require('path');
const cp     = require('child_process');
const http   = require('http');
const crypto = require('crypto');
const { normalizeBrowserError } = require('./browser-error-map');

const ROOT           = __dirname;
const PAGES_DIR      = path.join(ROOT, 'pages');
const APP_FL         = path.join(ROOT, 'server.fl');
const CSS_FILE       = path.join(ROOT, 'public', 'app.css');
const BUILD_JS       = path.join(ROOT, 'fl-front-build.js');
const BUILD_STATE_FILE = path.join(ROOT, '.build-state.json');
const BROWSER_STATE_FILE = path.join(ROOT, '.browser-state.json');
const HMR_STATE_FILE = path.join(ROOT, '.hmr-event.json');
const RUNTIME        = path.join(ROOT, 'runtime', 'bootstrap.js');
const HMR_PORT       = Number(process.env.HMR_PORT || 40851);
const APP_PORT       = Number(process.env.PORT || 40860);

let serverProc    = null;
let debounceTimer = null;
let hmrClients    = [];
let hmrVersion    = 0;
let hmrType       = '';
let hmrMeta       = {};
let rebuildInProgress = false;
const pendingChanges = new Set();
const fileHashes  = new Map();   // full file hash
const logicHashes = new Map();   // (style …) 제거 후 해시 — CSS-only 판별

// 빌드 상태 (fl-front-build.js가 .build-state.json에 저장)
let lastBuildState = {
  ok: false,
  time: null,
  routes: [],
  helpers: [],
  sourceMap: {},
  sourceMapLines: {},
  warnings: [],
};

function loadBuildState() {
  try {
    lastBuildState = JSON.parse(fs.readFileSync(BUILD_STATE_FILE, 'utf8'));
  } catch {}
}


function loadBrowserState() {
  try {
    return JSON.parse(fs.readFileSync(BROWSER_STATE_FILE, 'utf8'));
  } catch {
    return { ok: false, status: 'missing' };
  }
}


// 소스맵 역추적: _app.fl 라인 번호 → { file, line } (pages/*.flx 내 상대 라인)
function resolveSourceLine(lineNum) {
  const exact = lastBuildState.sourceMapLines?.[String(lineNum)];
  if (exact) return { file: exact.file, line: exact.line, column: exact.column || 0 };
  const map = lastBuildState.sourceMap || {};
  for (const [range, file] of Object.entries(map)) {
    const [s, e] = range.split('-').map(Number);
    if (lineNum >= s && lineNum <= e) {
      return { file, line: lineNum - s + 1 };
    }
  }
  return null;
}

// 에러 출력에서 "at line N, col M" → 원본 파일 위치로 치환
function translateLines(msg) {
  return msg.replace(/at line (\d+), col (\d+)/g, (match, l, c) => {
    const src = resolveSourceLine(Number(l));
    if (src) return `at line ${src.line}, col ${c} \x1b[36m← ${src.file}:${src.line}\x1b[0m`;
    return match;
  });
}

// ── 브라우저 에러 로그 (AI 조회용) ───────────────────────────
const errorLog = [];
const MAX_ERRORS = 50;

function addError(entry) {
  const normalized = normalizeBrowserError(entry, lastBuildState);
  errorLog.unshift({ ...normalized, time: new Date().toISOString() });
  if (errorLog.length > MAX_ERRORS) errorLog.pop();
  // 터미널 출력 — Island 에러는 별도 색상
  if (normalized.type === 'island') {
    console.log(`\x1b[35m[island error]\x1b[0m ${normalized.message}`);
    if (normalized.source) console.log(`  phase: ${normalized.source}`);
    if (normalized.stack && normalized.stack !== 'undefined') {
      const line = normalized.stack.split('\n')[1];
      if (line) console.log(`  ${line.trim()}`);
    }
  } else {
    const color = normalized.type === 'error' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${color}[browser ${normalized.type}]\x1b[0m ${normalized.message}`);
    if (normalized.source) console.log(`  at ${normalized.source}:${normalized.line}`);
  }
}

// ── HMR + Error 서버 (포트 40851) ────────────────────────────
const hmrServer = http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  const cors = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin === `http://localhost:${APP_PORT}` || origin === `http://127.0.0.1:${APP_PORT}`) {
    cors['Access-Control-Allow-Origin'] = origin;
    cors.Vary = 'Origin';
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors); res.end(); return;
  }

  // HMR state proxy
  if (req.url.startsWith('/~hmr-state')) {
    const query = new URL(req.url, 'http://127.0.0.1').searchParams;
    const since = Number(query.get('since') || 0);
    const type = hmrVersion > since ? hmrType : '';
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ version: hmrVersion, type, ...hmrMeta }));
    return;
  }

  // HMR SSE
  if (req.url === '/~hmr') {
    res.writeHead(200, { ...cors,
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('data: connected\n\n');
    hmrClients.push(res);
    req.on('close', () => {
      hmrClients = hmrClients.filter(c => c !== res);
    });
    return;
  }

  // 브라우저 에러 수집 (POST /~errors)
  if (req.url === '/~errors' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        addError(entry);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400, cors); res.end();
      }
    });
    return;
  }

  // 에러 목록 조회 (GET /~errors) — Claude가 curl로 확인
  if (req.url === '/~errors' && req.method === 'GET') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorLog, null, 2));
    return;
  }

  // 에러 초기화 (DELETE /~errors)
  if (req.url === '/~errors' && req.method === 'DELETE') {
    errorLog.length = 0;
    res.writeHead(200, cors); res.end('{"ok":true}');
    return;
  }

  // ── /~ai/* — AI 전용 컨텍스트 쿼리 엔드포인트 ──────────────
  if (req.url.startsWith('/~ai') && req.method === 'GET') {
    const u = req.url.replace(/\?.*$/, '');
    const json = (obj) => { res.writeHead(200,{...cors,'Content-Type':'application/json'}); res.end(JSON.stringify(obj,null,2)); };

    // GET /~ai — 전체 요약
    if (u === '/~ai') {
      json({
        build:  { ok: lastBuildState.ok, time: lastBuildState.time, elapsed: lastBuildState.elapsed },
        issues: (lastBuildState.issues||[]),
        routes: (lastBuildState.routes||[]).map(r=>r.route),
        helpers: lastBuildState.helpers||[],
        store_keys: lastBuildState.store_keys||[],
        contracts: lastBuildState.contracts || [],
        contract_summary: lastBuildState.contractSummary || {},
        repo_commit: lastBuildState.repoCommit || '',
        browser_state: loadBrowserState(),
        browser_errors: errorLog.slice(0,10),
        endpoints: {
          '/~ai':        'GET — 이 요약',
          '/~ai/routes': 'GET — 라우트 + 파일 + fnName',
          '/~ai/fns':    'GET — defn 시그니처 목록',
          '/~ai/store':  'GET — store 키 + 초기값',
          '/~ai/issues': 'GET — 빌드 이슈 목록 (errors+warns)',
          '/~ai/errors': 'GET — 브라우저 런타임 에러',
          '/~ai/contracts': 'GET — AI contract 목록 + readiness',
          '/~ai/browser': 'GET — 브라우저 탭 감시 상태',
        },
      });
      return;
    }

    // GET /~ai/routes
    if (u === '/~ai/routes') {
      json({ routes: lastBuildState.routes || [] });
      return;
    }

    // GET /~ai/fns — 전체 .flx 파일의 defn 시그니처
    if (u === '/~ai/fns') {
      try {
        const fs2 = require('fs'), path2 = require('path');
        const pagesDir = path2.join(__dirname, 'pages');
        const fns = [];
        const seen = new Set();
        function scanDir(dir) {
          for (const entry of fs2.readdirSync(dir, {withFileTypes:true})) {
            const full = path2.join(dir, entry.name);
            if (entry.isDirectory()) { scanDir(full); continue; }
            if (!entry.name.endsWith('.flx') && !entry.name.endsWith('.fl')) continue;
            const src = fs2.readFileSync(full,'utf8');
            for (const m of src.matchAll(/\(defn\s+([\w-]+[!?]?)\s+\[([^\]]*)\]/g)) {
              const key = m[1]+':'+path2.basename(full);
              if (seen.has(key)) continue; seen.add(key);
              fns.push({ name:m[1], params:m[2].trim().split(/\s+/).filter(Boolean), file:path2.basename(full) });
            }
          }
        }
        scanDir(pagesDir);
        json({ count: fns.length, fns });
      } catch(e) { json({ error: e.message }); }
      return;
    }

    // GET /~ai/store
    if (u === '/~ai/store') {
      json({ store_keys: lastBuildState.store_keys || [] });
      return;
    }

    // GET /~ai/issues
    if (u === '/~ai/issues') {
      const issues = lastBuildState.issues || [];
      json({
        ok: issues.filter(i=>i.level==='error').length === 0,
        errors: issues.filter(i=>i.level==='error'),
        warns:  issues.filter(i=>i.level==='warn'),
      });
      return;
    }

    // GET /~ai/errors — 브라우저 런타임 에러
    if (u === '/~ai/errors') {
      json({ count: errorLog.length, errors: errorLog.slice(0,20) });
      return;
    }

    // GET /~ai/contracts — 계약 readiness
    if (u === '/~ai/contracts') {
      json({
        repo_commit: lastBuildState.repoCommit || '',
        contract_summary: lastBuildState.contractSummary || {},
        contracts: lastBuildState.contracts || [],
        browser_state: loadBrowserState(),
      });
      return;
    }

    // GET /~ai/browser — 브라우저 탭 감시 상태
    if (u === '/~ai/browser') {
      json({ browser_state: loadBrowserState() });
      return;
    }

    // GET /~ai/source?file=_app.fl&line=123 — 개발 오류 오버레이용 읽기 전용 뷰어
    if (u === '/~ai/source') {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const requested = qs.get('file') || '';
      const pathSegments = requested.split('/');
      const safeSegments = pathSegments.every((segment) => segment && segment !== '.' && segment !== '..');
      const requestedLine = Number(qs.get('line') || 0);
      const allowed = safeSegments && (requested === '_app.fl'
        || /^(?:pages|components|src)\/[^\\/]+(?:\/[^\\/]+)*\.(?:flx|fl)$/.test(requested));
      if (!allowed) {
        res.writeHead(400, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('허용된 FreeLang 소스 파일만 열 수 있습니다');
        return;
      }
      let file = requested;
      let line = requestedLine;
      if (requested === '_app.fl' && requestedLine > 0) {
        const mapped = resolveSourceLine(requestedLine);
        if (mapped) { file = mapped.file; line = mapped.line; }
      }
      const fullPath = path.resolve(ROOT, file);
      const relative = path.relative(ROOT, fullPath);
      const inside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      if (!inside || !fs.existsSync(fullPath)) {
        res.writeHead(404, { ...cors, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('소스 파일을 찾을 수 없습니다');
        return;
      }
      const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const sourceLines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
      const center = Math.max(1, line || 1);
      const from = Math.max(1, center - 5);
      const to = Math.min(sourceLines.length, center + 5);
      const rows = [];
      for (let n = from; n <= to; n += 1) {
        const active = n === center ? ' style="background:#3f2d12;color:#fef3c7"' : '';
        rows.push(`<tr${active}><td style="padding:0 14px;color:#71717a;text-align:right;user-select:none">${n}</td><td style="padding:0 14px;white-space:pre">${escapeHtml(sourceLines[n - 1] || '')}</td></tr>`);
      }
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(file)}:${center}</title><style>body{margin:0;background:#09090b;color:#e4e4e7;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}header{padding:16px 20px;border-bottom:1px solid #27272a;color:#fbbf24;position:sticky;top:0;background:#18181b}table{border-collapse:collapse;width:100%}td{vertical-align:top}</style><header>${escapeHtml(file)}:${center}</header><table>${rows.join('')}</table>`);
      return;
    }

    // GET /~ai/test?file=pages/examples/23-like-store.flx&island=likebutton&click=button&store={"likes":5}
    // Island headless 실행기 HTTP API
    if (u === '/~ai/test') {
      const qs  = new URLSearchParams(req.url.split('?')[1] || '');
      const file = qs.get('file');
      if (!file) { json({ error: 'file 파라미터 필요. 예: /~ai/test?file=pages/examples/06-counter.flx' }); return; }
      const pagesRoot = require('path').resolve(__dirname, 'pages');
      const fullPath = require('path').resolve(__dirname, file);
      const insidePages = fullPath.startsWith(`${pagesRoot}${require('path').sep}`);
      if (!insidePages || !fullPath.endsWith('.flx')) {
        json({ error: 'pages 내부의 .flx 파일만 테스트할 수 있습니다' }); return;
      }
      try {
        require('fs').accessSync(fullPath);
      } catch {
        json({ error: `파일 없음: ${file}` }); return;
      }
      try {
        const runner = require('./island-runner');
        const opts = {
          island:   qs.get('island')   || undefined,
          click:    qs.get('click')    || undefined,
          dispatch: qs.get('dispatch') || undefined,
          store:    qs.get('store')    ? JSON.parse(qs.get('store')) : undefined,
        };
        runner.run(fullPath, opts).then(result => json(result)).catch(e => json({ ok:false, error:e.message }));
      } catch(e) {
        json({ ok:false, error:e.message });
      }
      return;
    }

    res.writeHead(404,cors); res.end(JSON.stringify({error:'unknown /~ai endpoint'}));
    return;
  }

  res.writeHead(404, cors); res.end();
});

function hmrReload(type = 'reload', meta = {}) {
  hmrVersion += 1;
  hmrType = type;
  hmrMeta = meta && typeof meta === 'object' ? meta : {};
  try {
    fs.writeFileSync(HMR_STATE_FILE, JSON.stringify({ version: hmrVersion, type, ...hmrMeta }));
  } catch (e) {
    console.warn(`[hmr] 상태 파일 기록 실패: ${e.message}`);
  }
  const dead = [];
  for (const client of hmrClients) {
    try { client.write(`data: ${type}\n\n`); }
    catch { dead.push(client); }
  }
  hmrClients = hmrClients.filter(c => !dead.includes(c));
  console.log(`[hmr] ${type} → ${hmrClients.length}개 클라이언트`);
}

function buildErrorMeta(error, changedFile = '') {
  const output = String(error?.output || error?.message || 'build failed');
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const sourceMatch = clean.match(/(?:^|\s)((?:pages|components|src)\/[^\s:]+\.flx):(\d+)(?::(\d+))?/m);
  const known = [...parseFatalBuildErrors(clean), ...parseBuildErrors(clean)][0];
  return {
    message: (known || clean.split('\n').filter(Boolean).slice(-1)[0] || 'build failed').slice(0, 1600),
    source: sourceMatch?.[1] || (changedFile ? path.relative(ROOT, changedFile) : ''),
    line: sourceMatch ? Number(sourceMatch[2]) : Number(clean.match(/line (\d+)/i)?.[1] || 0),
    col: sourceMatch?.[3] ? Number(sourceMatch[3]) : 0,
    stack: clean.slice(-2400),
  };
}

// ── 파일 해시 (변경 감지용) ───────────────────────────────────
function fileHash(filePath) {
  try {
    return crypto.createHash('md5')
      .update(fs.readFileSync(filePath))
      .digest('hex').slice(0, 8);
  } catch { return ''; }
}

function hasChanged(filePath) {
  const cur  = fileHash(filePath);
  const prev = fileHashes.get(filePath);
  fileHashes.set(filePath, cur);
  return cur !== prev;
}

// (style …) sexpr 제거 — 로직 해시용
function stripStyleBlocks(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('(style ', i) || src.startsWith('(style\n', i) || src.startsWith('(style\t', i)) {
      let d = 0;
      let j = i;
      for (; j < src.length; j++) {
        const c = src[j];
        if (c === '"') {
          j++;
          while (j < src.length && src[j] !== '"') {
            if (src[j] === '\\') j++;
            j++;
          }
          continue;
        }
        if (c === '(') d++;
        else if (c === ')') {
          d--;
          if (d === 0) { j++; break; }
        }
      }
      out += ' ';
      i = j;
      continue;
    }
    out += src[i++];
  }
  return out;
}

function logicHashOf(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(stripStyleBlocks(raw)).digest('hex').slice(0, 8);
  } catch {
    return '';
  }
}

// CSS 전용 변경: style-compiler / app.css / .flx에서 (style)만 바뀜
function isCssOnlyChange(changedFile, prevLogicHash) {
  const base = path.basename(changedFile);
  if (base === 'style-compiler.js') return true;
  if (base === 'app.css') return true;
  if (!changedFile.endsWith('.flx')) return false;
  const nextLogic = logicHashOf(changedFile);
  if (!prevLogicHash) return false;
  // 로직 동일 + 파일 자체는 변경됨 → style DSL만 바뀐 것
  return nextLogic === prevLogicHash && nextLogic !== '';
}

// ── 에러 루프 상태 추적 ───────────────────────────────────────
let lastBuildErrors = new Set();  // 직전 빌드의 에러 메시지 집합

// HANDOFF.airc에 에러 자동 기록
function recordToAIRC(errors, resolved) {
  try {
    const handoffPath = path.join(ROOT, 'HANDOFF.airc');
    const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
    if (!handoff.auto_errors) handoff.auto_errors = [];
    const now = new Date().toISOString();
    for (const msg of errors) {
      const alreadyOpen = handoff.auto_errors.some(e => e.message === msg && e.status === 'open');
      if (!alreadyOpen) {
        handoff.auto_errors.unshift({ time: now, message: msg, status: 'open' });
      }
    }
    for (const msg of resolved) {
      handoff.auto_errors = handoff.auto_errors.map(e =>
        e.message === msg ? { ...e, status: 'resolved', resolved_at: now } : e
      );
    }
    // 최근 20개만 유지
    handoff.auto_errors = handoff.auto_errors.slice(0, 20);
    fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
  } catch {}
}

// 빌드 에러 파싱 (출력에서 ✗ 패턴 추출)
function parseBuildErrors(output) {
  const errors = new Set();
  for (const line of output.split('\n')) {
    const m = line.match(/✗.*—\s*(.+)/);
    if (m) errors.add(m[1].trim());
    // 파서 에러
    const p = line.match(/Unexpected character.+at line \d+/);
    if (p) errors.add(p[0]);
    if (/미닫힘|파싱 오류|E_PARSE_|Unexpected token|syntax error/i.test(line)) {
      errors.add(line.trim());
    }
  }
  return errors;
}

function parseFatalBuildErrors(output) {
  return new Set(output.split('\n')
    .filter((line) => /미닫힘|파싱 오류|E_PARSE_|Unexpected token|Unexpected character|syntax error/i.test(line))
    .map((line) => line.trim())
    .filter(Boolean));
}

// ── 빌드 ──────────────────────────────────────────────────────
function build() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let output = '';
    const p = cp.spawn('node', [BUILD_JS], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', d => { const s = d.toString(); process.stdout.write(s); output += s; });
    p.stderr.on('data', d => { const s = d.toString(); process.stderr.write(s); output += s; });
    p.on('close', code => {
      console.log(`[dev] 빌드 ${Date.now() - start}ms`);
      if (code === 0) {
        loadBuildState();
        // 빌드 성공 시 에러 델타 계산
        const currentErrors = parseBuildErrors(output);
        const resolved = [...lastBuildErrors].filter(e => !currentErrors.has(e));
        const newErrors = [...currentErrors].filter(e => !lastBuildErrors.has(e));
        if (resolved.length > 0) {
          console.log(`\x1b[32m[loop] ✅ 해결됨:\x1b[0m ${resolved.join(', ')}`);
        }
        if (newErrors.length > 0) {
          console.log(`\x1b[31m[loop] ❌ 새 오류:\x1b[0m ${newErrors.join(', ')}`);
        }
        if (resolved.length > 0 && newErrors.length === 0) {
          console.log(`\x1b[32m[loop] 🎉 모든 오류 해결 — 루프 완료\x1b[0m`);
        }
        if (resolved.length > 0 || newErrors.length > 0) {
          recordToAIRC(newErrors, resolved);
        }
        lastBuildErrors = currentErrors;
        const fatalErrors = parseFatalBuildErrors(output);
        if (fatalErrors.size > 0) {
          const error = new Error('build diagnostics reported errors');
          error.output = output;
          reject(error);
          return;
        }
        resolve();
      } else {
        const error = new Error(`build exit ${code}`);
        error.output = output;
        reject(error);
      }
    });
  });
}

// ── 서버 시작 (포트 오픈 감지) ────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    if (serverProc) { serverProc.kill('SIGTERM'); serverProc = null; }

    serverProc = cp.spawn('node', [RUNTIME, 'run', APP_FL], {
      cwd: ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        FL_DEV: '1',
        FL_FILE_BASE: process.env.FL_FILE_BASE || ROOT,
        FL_HMR_STATE_FILE: HMR_STATE_FILE,
        FL_HMR_PORT: String(HMR_PORT),
        FL_HTTP_ALLOW: process.env.FL_HTTP_ALLOW || '127.0.0.1,localhost',
      },
    });

    // stdout/stderr 출력 + 포트 오픈 감지
    let runtimeOk = false;
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve();
    };
    const waitForHttp = (attempt = 0) => {
      const probe = http.get({ hostname: '127.0.0.1', port: APP_PORT, path: '/', timeout: 250 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return finish();
        retry();
      });
      probe.on('error', retry);
      probe.on('timeout', () => { probe.destroy(); retry(); });
      function retry() {
        if (settled) return;
        if (attempt >= 120) return finish(new Error(`server did not become ready on :${APP_PORT}`));
        setTimeout(() => waitForHttp(attempt + 1), 100);
      }
    };
    const handleOutput = (raw) => {
      // 런타임 파서 에러 감지 (stdout + stderr 공통)
      if (raw.includes('Unexpected character') || raw.includes('실행 오류')) {
        const errLines = raw.split('\n').filter(l => l.includes('Unexpected character'));
        const newErrors = errLines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
        if (newErrors.length > 0) {
          newErrors.forEach(e => lastBuildErrors.add(e));
          recordToAIRC(newErrors, []);
          console.log(`\x1b[31m[loop] ❌ 런타임 에러:\x1b[0m ${newErrors.join(' | ')}`);
        }
      }
    };
    serverProc.stdout.on('data', d => {
      const raw = d.toString();
      const msg = translateLines(raw);
      process.stdout.write(msg);
      handleOutput(raw);
      if (msg.includes('listening') || msg.includes('server listening')) {
        runtimeOk = true;
        // 정상 기동 → 이전 런타임 에러 해결 체크
        const runtimeErrors = [...lastBuildErrors].filter(e => e.includes('Unexpected character'));
        if (runtimeErrors.length > 0) {
          console.log(`\x1b[32m[loop] ✅ 런타임 에러 해결됨\x1b[0m`);
          recordToAIRC([], runtimeErrors);
          runtimeErrors.forEach(e => lastBuildErrors.delete(e));
        }
        waitForHttp();
      }
    });
    serverProc.stderr.on('data', d => {
      const raw = d.toString();
      process.stderr.write(translateLines(raw));
      handleOutput(raw);
    });
    serverProc.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM') console.log(`[dev] 서버 종료 (code=${code})`);
      if (signal !== 'SIGTERM' && !runtimeOk) {
        finish(new Error(`runtime exited before ready (code=${code}, signal=${signal || 'none'})`));
      }
    });

    // 안전망: 준비 신호가 없으면 실패로 처리한다. 죽은 서버에
    // soft-reload를 보내 브라우저를 더 나쁜 상태로 만들지 않는다.
    setTimeout(() => {
      if (!runtimeOk) finish(new Error(`server readiness timeout on :${APP_PORT}`));
    }, 15000);
  });
}

// ── 리빌드 핸들러 ─────────────────────────────────────────────
async function performRebuild(changedFile) {
  const prevLogic = logicHashes.get(changedFile) || '';
  if (!hasChanged(changedFile) && path.basename(changedFile) !== 'app.css') {
    console.log(`[dev] 변경 없음 (캐시 일치): ${path.relative(ROOT, changedFile)}`);
    return;
  }

  console.log(`\n[dev] 변경: ${path.relative(ROOT, changedFile)}`);
  const cssBefore = fileHash(CSS_FILE);
  const cssOnly = isCssOnlyChange(changedFile, prevLogic);

  // CSS 전용 변경 → 빌드만, 서버 재시작 없이 css-reload (L2)
  if (cssOnly) {
    console.log('[dev] CSS 전용 변경 — 빌드만 + css-reload');
    try {
      await build();
      logicHashes.set(changedFile, logicHashOf(changedFile));
      const cssAfter = fileHash(CSS_FILE);
      if (cssBefore !== cssAfter || path.basename(changedFile) === 'app.css') {
        hmrReload('css-reload');
      } else {
        // inline <style>만 바뀐 경우는 soft-reload로 HTML 갱신
        hmrReload('soft-reload');
      }
    } catch (e) {
      console.error('[dev] 빌드 실패:', e.message);
      hmrReload('build-error', buildErrorMeta(e, changedFile));
    }
    return;
  }

  // 일반 변경 → 빌드 + 서버 재시작 + soft-reload (L3, 실패 시 클라이언트 full reload)
  console.log('[dev] 빌드 중...');
  try {
    const start = Date.now();
    await build();
    logicHashes.set(changedFile, logicHashOf(changedFile));
    console.log('[dev] 서버 재시작...');
    await startServer();
    const elapsed = Date.now() - start;
    console.log(`[dev] ✅ 재시작 완료 ${elapsed}ms → soft-reload`);
    hmrReload('soft-reload'); // L3 (클라이언트 실패 시 full reload)
  } catch (e) {
    console.error('[dev] 실패:', e.message);
    hmrReload('build-error', buildErrorMeta(e, changedFile));
  }
}

// 빌드가 산출한 app.css/_app.fl 변경을 감시 입력으로 재큐잉하지 않는다.
// 사용자의 다음 편집은 빌드가 끝난 뒤 정상적으로 새로 들어온다.
async function rebuild(changedFile) {
  if (rebuildInProgress) {
    // 빌드 중 들어온 사용자 변경을 버리지 않는다. 산출물(app.css)은
    // watcher에서 제외하고, 실제 소스 변경만 여기로 들어온다.
    pendingChanges.add(changedFile);
    return;
  }
  rebuildInProgress = true;
  try {
    return await performRebuild(changedFile);
  } finally {
    rebuildInProgress = false;
    const nextChange = pendingChanges.values().next().value;
    if (nextChange) {
      pendingChanges.delete(nextChange);
      setTimeout(() => rebuild(nextChange), 50);
    }
  }
}

// ── 파일 감시 ─────────────────────────────────────────────────
function watchAll() {
  const PUBLIC_DIR = path.join(ROOT, 'public');
  const dirs = [PAGES_DIR, ROOT, PUBLIC_DIR];
  const collectSubDirs = (dir) => {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          dirs.push(path.join(dir, e.name));
          collectSubDirs(path.join(dir, e.name));
        }
      }
    } catch {}
  };
  collectSubDirs(PAGES_DIR);

  const watched = new Set();
  for (const dir of dirs) {
    if (watched.has(dir)) continue;
    watched.add(dir);
    try {
      fs.watch(dir, (event, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.flx') && !filename.endsWith('.js') && filename !== 'app.css') return;
        if (filename.includes('_app') || filename.startsWith('dev-server')) return;
        const full = path.join(dir, filename);
        // 빌드가 생성한 CSS 이벤트는 입력으로 재큐잉하지 않는다.
        if (rebuildInProgress && full === CSS_FILE) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => rebuild(full), 250);  // 300→250ms
      });
    } catch (e) { console.warn(`[dev] watch 실패 ${dir}:`, e.message); }
  }
  console.log(`[dev] 감시 중: ${watched.size}개 디렉토리`);
}

// ── 초기 해시 스냅샷 ──────────────────────────────────────────
function snapshotHashes() {
  function scan(dir) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('.')) scan(full);
        else if (e.name.endsWith('.flx') || e.name.endsWith('.js') || e.name === 'app.css') {
          fileHashes.set(full, fileHash(full));
          if (e.name.endsWith('.flx')) logicHashes.set(full, logicHashOf(full));
        }
      }
    } catch {}
  }
  scan(PAGES_DIR);
  scan(ROOT);
}

// ── 메인 ──────────────────────────────────────────────────────
(async () => {
  console.log('[dev] FL-Front 개발 서버 시작...');

  hmrServer.listen(HMR_PORT, '127.0.0.1', () =>
    console.log(`[hmr] SSE → http://127.0.0.1:${HMR_PORT}/~hmr`)
  );

  hmrServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[hmr] 포트 ${HMR_PORT} 이미 사용 중 — 기존 dev-server 프로세스를 종료 후 재시작하세요`);
      process.exit(1);
    }
  });

  snapshotHashes();

  try { await build(); } catch (e) {
    console.error('[dev] 초기 빌드 실패:', e.message);
    process.exit(1);
  }

  await startServer();
  watchAll();

  function shutdown() {
    console.log('\n[dev] 종료');
    if (serverProc) {
      serverProc.kill('SIGTERM');
      setTimeout(() => { if (serverProc && !serverProc.killed) serverProc.kill('SIGKILL'); }, 2000);
    }
    hmrServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
