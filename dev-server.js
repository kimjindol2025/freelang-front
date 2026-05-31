#!/usr/bin/env node
// dev-server.js — .flx 파일 변경 감시 + 자동 빌드·재시작 + HMR SSE

const fs   = require('fs');
const path = require('path');
const cp   = require('child_process');
const http = require('http');

const ROOT      = __dirname;
const PAGES_DIR = path.join(ROOT, 'pages');
const APP_FL    = path.join(ROOT, '_app.fl');
const BUILD_JS  = path.join(ROOT, 'fl-front-build.js');
const RUNTIME   = path.join(ROOT, '../../freelang-v11/bootstrap.js');
const HMR_PORT  = 40851;  // HMR SSE 전용 포트

let serverProc    = null;
let debounceTimer = null;
let hmrClients    = [];  // SSE 연결 목록

// ── HMR SSE 서버 ──
const hmrServer = http.createServer((req, res) => {
  if (req.url === '/~hmr') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: connected\n\n');
    hmrClients.push(res);
    req.on('close', () => {
      hmrClients = hmrClients.filter(c => c !== res);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

function hmrReload() {
  const dead = [];
  for (const client of hmrClients) {
    try {
      client.write('data: reload\n\n');
    } catch {
      dead.push(client);
    }
  }
  hmrClients = hmrClients.filter(c => !dead.includes(c));
  console.log(`[hmr] reload 신호 → ${hmrClients.length}개 클라이언트`);
}

function build() {
  return new Promise((resolve, reject) => {
    const p = cp.spawn('node', [BUILD_JS], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`build exit ${code}`)));
  });
}

function startServer() {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    serverProc = null;
  }
  serverProc = cp.spawn('node', [RUNTIME, 'run', APP_FL], {
    cwd: ROOT, stdio: 'inherit',
  });
  serverProc.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') console.log(`[dev] 서버 종료 (code=${code})`);
  });
}

async function rebuild(changedFile) {
  console.log(`\n[dev] 변경 감지: ${path.relative(ROOT, changedFile)}`);
  console.log('[dev] 빌드 중...');
  try {
    await build();
    console.log('[dev] 서버 재시작...');
    startServer();
    // 서버 뜰 때까지 잠깐 대기 후 HMR 신호
    setTimeout(() => hmrReload(), 800);
  } catch (e) {
    console.error('[dev] 빌드 실패:', e.message);
  }
}

function collectDirs(dir, result = []) {
  result.push(dir);
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        collectDirs(path.join(dir, e.name), result);
      }
    }
  } catch {}
  return result;
}

function watchAll() {
  const dirs = collectDirs(PAGES_DIR);
  dirs.push(ROOT);
  const watched = new Set();
  for (const dir of dirs) {
    if (watched.has(dir)) continue;
    watched.add(dir);
    try {
      fs.watch(dir, (event, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.flx') && !filename.endsWith('.js')) return;
        if (filename.includes('_app')) return;
        const full = path.join(dir, filename);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => rebuild(full), 300);
      });
    } catch (e) {
      console.warn(`[dev] watch 실패 ${dir}: ${e.message}`);
    }
  }
  console.log(`[dev] 감시 중: ${watched.size}개 디렉토리`);
}

(async () => {
  console.log('[dev] FL-Front 개발 서버 시작...');

  // HMR SSE 서버 먼저 시작
  hmrServer.listen(HMR_PORT, () => {
    console.log(`[hmr] SSE 서버 → http://localhost:${HMR_PORT}/~hmr`);
  });

  try { await build(); } catch (e) { console.error('[dev] 초기 빌드 실패:', e.message); process.exit(1); }

  startServer();
  watchAll();

  process.on('SIGINT', () => {
    console.log('\n[dev] 종료');
    if (serverProc) serverProc.kill('SIGTERM');
    hmrServer.close();
    process.exit(0);
  });
})();
