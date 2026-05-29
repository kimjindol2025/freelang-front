#!/usr/bin/env node
// dev-server.js — pages/ 감시 + 자동 rebuild + restart

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const BOOTSTRAP = '/root/kim/freelang-v11/bootstrap.js';
const APP_FILE  = path.join(__dirname, '_app.fl');
const WATCH_DIR = path.join(__dirname, 'pages');
const BUILD_CMD = `node ${path.join(__dirname, 'fl-front-build.js')}`;

let serverProc = null;
let restartTimer = null;

function build() {
  try {
    execSync(BUILD_CMD, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('[dev] 빌드 실패:', e.message);
    return false;
  }
}

function startServer() {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    serverProc = null;
  }
  serverProc = spawn('node', ['--stack-size=8192', BOOTSTRAP, 'run', APP_FILE], {
    stdio: 'inherit',
  });
  serverProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error('[dev] 서버 종료 (code=' + code + ')');
    }
  });
  console.log('[dev] 서버 시작됨');
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log('[dev] 변경 감지 → rebuild + restart');
    if (build()) startServer();
  }, 300);
}

// 초기 빌드 + 서버 시작
if (!build()) process.exit(1);
startServer();

// pages/ 재귀 감시
function watchDir(dir) {
  fs.watch(dir, { recursive: true }, (event, filename) => {
    if (filename && filename.endsWith('.flx')) {
      console.log('[dev] 변경:', filename);
      scheduleRestart();
    }
  });
}
watchDir(WATCH_DIR);

console.log('[dev] 감시 중: pages/**/*.flx (Ctrl+C로 종료)');

process.on('SIGINT', () => {
  if (serverProc) serverProc.kill();
  process.exit(0);
});
