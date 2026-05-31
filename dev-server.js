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

const ROOT      = __dirname;
const PAGES_DIR = path.join(ROOT, 'pages');
const APP_FL    = path.join(ROOT, '_app.fl');
const CSS_FILE  = path.join(ROOT, 'public', 'app.css');
const BUILD_JS  = path.join(ROOT, 'fl-front-build.js');
const RUNTIME   = '/home/kimjin/freelang-v11/bootstrap.js';
const HMR_PORT  = 40851;

let serverProc    = null;
let debounceTimer = null;
let hmrClients    = [];
const fileHashes  = new Map();

// ── 브라우저 에러 로그 (AI 조회용) ───────────────────────────
const errorLog = [];
const MAX_ERRORS = 50;

function addError(entry) {
  errorLog.unshift({ ...entry, time: new Date().toISOString() });
  if (errorLog.length > MAX_ERRORS) errorLog.pop();
  // 터미널에도 출력
  const color = entry.type === 'error' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}[browser ${entry.type}]\x1b[0m ${entry.message}`);
  if (entry.source) console.log(`  at ${entry.source}:${entry.line}`);
}

// ── HMR + Error 서버 (포트 40851) ────────────────────────────
const hmrServer = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors); res.end(); return;
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

  res.writeHead(404, cors); res.end();
});

function hmrReload(type = 'reload') {
  const dead = [];
  for (const client of hmrClients) {
    try { client.write(`data: ${type}\n\n`); }
    catch { dead.push(client); }
  }
  hmrClients = hmrClients.filter(c => !dead.includes(c));
  console.log(`[hmr] ${type} → ${hmrClients.length}개 클라이언트`);
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

// ── CSS 전용 변경 여부 판별 ──────────────────────────────────
function isCssOnlyChange(changedFile) {
  // style-compiler.js 또는 style 블록만 있는 .flx
  if (path.basename(changedFile) === 'style-compiler.js') return true;
  if (!changedFile.endsWith('.flx')) return false;
  const content = fs.readFileSync(changedFile, 'utf8');
  // style 블록만 있고 defn render 없으면 CSS 전용
  const hasStyle  = content.includes('(style ');
  const hasRender = content.includes('(defn render');
  return hasStyle && !hasRender;
}

// ── 빌드 ──────────────────────────────────────────────────────
function build() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const p = cp.spawn('node', [BUILD_JS], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', code => {
      console.log(`[dev] 빌드 ${Date.now() - start}ms`);
      code === 0 ? resolve() : reject(new Error(`build exit ${code}`));
    });
  });
}

// ── 서버 시작 (포트 오픈 감지) ────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    if (serverProc) { serverProc.kill('SIGTERM'); serverProc = null; }

    serverProc = cp.spawn('node', [RUNTIME, 'run', APP_FL], {
      cwd: ROOT, stdio: 'pipe',
    });

    // stdout/stderr 출력 + 포트 오픈 감지
    serverProc.stdout.on('data', d => {
      const msg = d.toString();
      process.stdout.write(msg);
      if (msg.includes('listening') || msg.includes('server listening')) {
        resolve();  // 포트 오픈 확인 → 즉시 HMR
      }
    });
    serverProc.stderr.on('data', d => process.stderr.write(d.toString()));
    serverProc.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM') console.log(`[dev] 서버 종료 (code=${code})`);
    });

    // 안전망: 3초 후 무조건 resolve
    setTimeout(resolve, 3000);
  });
}

// ── 리빌드 핸들러 ─────────────────────────────────────────────
async function rebuild(changedFile) {
  if (!hasChanged(changedFile)) {
    console.log(`[dev] 변경 없음 (캐시 일치): ${path.relative(ROOT, changedFile)}`);
    return;
  }

  console.log(`\n[dev] 변경: ${path.relative(ROOT, changedFile)}`);

  // CSS 전용 변경 → 빌드만, 서버 재시작 없이 CSS reload
  if (isCssOnlyChange(changedFile)) {
    console.log('[dev] CSS 전용 변경 — 빌드만 실행');
    try {
      await build();
      hmrReload('css-reload');  // 특수 신호 (향후 CSS만 교체 가능)
    } catch (e) { console.error('[dev] 빌드 실패:', e.message); }
    return;
  }

  // 일반 변경 → 빌드 + 서버 재시작
  console.log('[dev] 빌드 중...');
  try {
    const start = Date.now();
    await build();
    console.log('[dev] 서버 재시작...');
    await startServer();
    const elapsed = Date.now() - start;
    console.log(`[dev] ✅ 재시작 완료 ${elapsed}ms`);
    hmrReload();
  } catch (e) {
    console.error('[dev] 실패:', e.message);
  }
}

// ── 파일 감시 ─────────────────────────────────────────────────
function watchAll() {
  const dirs = [PAGES_DIR, ROOT];
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
        if (!filename.endsWith('.flx') && !filename.endsWith('.js')) return;
        if (filename.includes('_app') || filename.startsWith('dev-server')) return;
        const full = path.join(dir, filename);
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
        else if (e.name.endsWith('.flx') || e.name.endsWith('.js')) {
          fileHashes.set(full, fileHash(full));
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

  hmrServer.listen(HMR_PORT, () =>
    console.log(`[hmr] SSE → http://localhost:${HMR_PORT}/~hmr`)
  );

  snapshotHashes();

  try { await build(); } catch (e) {
    console.error('[dev] 초기 빌드 실패:', e.message);
    process.exit(1);
  }

  await startServer();
  watchAll();

  process.on('SIGINT', () => {
    console.log('\n[dev] 종료');
    if (serverProc) serverProc.kill('SIGTERM');
    hmrServer.close();
    process.exit(0);
  });
})();
