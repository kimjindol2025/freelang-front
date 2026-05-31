#!/usr/bin/env node
// fl-front-init.js — 새 프로젝트 스캐폴딩
// 사용: node fl-front-init.js <프로젝트명> [포트]

const fs   = require('fs');
const path = require('path');

const name = process.argv[2];
const port = parseInt(process.argv[3]) || 40850;

if (!name) {
  console.error('사용법: node fl-front-init.js <프로젝트명> [포트]');
  console.error('예시:  node fl-front-init.js my-app 40900');
  process.exit(1);
}

const TEMPLATE = path.join(__dirname);
const DEST     = path.join(process.cwd(), name);
const FL       = '/home/kimjin/freelang-v11/bootstrap.js';

if (fs.existsSync(DEST)) {
  console.error(`❌ 폴더 이미 존재: ${DEST}`);
  process.exit(1);
}

// ── 복사 대상 파일 목록 ──────────────────────────────────────
const COPY_FILES = [
  'fl-front-build.js',
  'dev-server.js',
  'style-compiler.js',
  'island-compiler.js',
  'pages/_layout.flx',
  'pages/_auth.flx',
  'pages/_db.flx',
  'pages/_error.flx',
  'pages/_charts.flx',
];

// ── 새 index.flx 템플릿 ─────────────────────────────────────
const INDEX_FLX = `; pages/index.flx — 홈 페이지
(defn render [req]
  (layout-html "홈"
    (str
      "<h1>${name}</h1>"
      "<p>FL-Front에 오신 것을 환영합니다.</p>"
      "<a href='/login'>로그인</a>")
    req))
`;

// ── package.json ─────────────────────────────────────────────
const PKG = {
  name,
  version: '0.1.0',
  scripts: {
    build: 'node fl-front-build.js',
    start: `node fl-front-build.js && node ${FL} run _app.fl`,
    dev: 'node dev-server.js',
  },
};

// ── ecosystem.config.js (PM2) ────────────────────────────────
const ECOSYSTEM = `module.exports = {
  apps: [{
    name: '${name}',
    script: './bootstrap-wrapper.js',
    cwd: '${DEST}',
    wait_ready: true,
    listen_timeout: 8000,
    kill_timeout: 5000,
    autorestart: true,
    env: { PORT: ${port}, NODE_ENV: 'production' }
  }]
};
`;

// ── bootstrap-wrapper.js ─────────────────────────────────────
const WRAPPER = `const http = require('http');
const servers = [];
const orig = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  servers.push(this);
  this.on('listening', () => { if (process.send) process.send('ready'); });
  return orig.apply(this, args);
};
process.on('SIGINT', () => {
  Promise.all(servers.map(s => new Promise(r => s.close(r)))).then(() => process.exit(0));
  setTimeout(() => process.exit(0), 4500);
});
process.argv = ['node', '${FL}', 'run', '${DEST}/_app.fl'];
require('${FL}');
`;

// ── .projectrc.json ──────────────────────────────────────────
const PROJECTRC = JSON.stringify({
  name,
  version: '0.1.0',
  language: 'FreeLang v11 + FL-Front',
  status: 'in_progress',
  description: `${name} — FL-Front 앱`,
  ports: [port],
  entry: '_app.fl',
  commands: {
    dev: 'node dev-server.js',
    build: 'node fl-front-build.js',
    start: `node ${FL} run _app.fl`,
  },
}, null, 2);

// ── 디렉토리/파일 생성 ───────────────────────────────────────
console.log(`\n🚀 FL-Front 프로젝트 생성: ${name} (포트 ${port})\n`);

fs.mkdirSync(DEST, { recursive: true });
fs.mkdirSync(path.join(DEST, 'pages'), { recursive: true });
fs.mkdirSync(path.join(DEST, 'public'), { recursive: true });
fs.mkdirSync(path.join(DEST, 'data'), { recursive: true });

// 템플릿 파일 복사
for (const file of COPY_FILES) {
  const src  = path.join(TEMPLATE, file);
  const dest = path.join(DEST, file);
  if (!fs.existsSync(src)) { console.warn(`  ⚠ 스킵: ${file}`); continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let content = fs.readFileSync(src, 'utf8');
  // 포트 교체
  content = content.replace(/const PORT\s*=\s*\d+/g, `const PORT = ${port}`);
  content = content.replace(/server-start \d+/g, `server-start ${port}`);
  fs.writeFileSync(dest, content, 'utf8');
  console.log(`  ✅ ${file}`);
}

// 새 파일 생성
fs.writeFileSync(path.join(DEST, 'pages', 'index.flx'), INDEX_FLX, 'utf8');
fs.writeFileSync(path.join(DEST, 'package.json'), JSON.stringify(PKG, null, 2), 'utf8');
fs.writeFileSync(path.join(DEST, 'ecosystem.config.js'), ECOSYSTEM, 'utf8');
fs.writeFileSync(path.join(DEST, 'bootstrap-wrapper.js'), WRAPPER, 'utf8');
fs.writeFileSync(path.join(DEST, '.projectrc.json'), PROJECTRC, 'utf8');

console.log(`  ✅ pages/index.flx (홈 페이지)`);
console.log(`  ✅ package.json`);
console.log(`  ✅ ecosystem.config.js (PM2)`);
console.log(`  ✅ bootstrap-wrapper.js`);
console.log(`  ✅ .projectrc.json`);

console.log(`
✨ 완료!

  cd ${name}
  node fl-front-build.js   # 빌드
  node dev-server.js       # 개발 서버 (HMR 포함)

  로그인: admin / admin123
  포트:   http://localhost:${port}
`);
