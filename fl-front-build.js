#!/usr/bin/env node
// fl-front-build.js — pages/*.flx 스캔 → _app.fl 단일 파일 생성 (load 불필요)

const fs   = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'pages');
const OUT_FILE  = path.join(__dirname, '_app.fl');
const PORT      = 3000;

function scanPages(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes  = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath  = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      routes.push(...scanPages(fullPath, relPath));
    } else if (entry.name.endsWith('.flx')) {
      routes.push({
        route:  fileToRoute(relPath),
        fnName: routeToFnName(relPath),
        file:   'pages/' + relPath,
      });
    }
  }
  return routes;
}

function fileToRoute(rel) {
  let r = '/' + rel.replace(/\.flx$/, '').replace(/\\/g, '/');
  r = r.replace(/\/index$/, '/');
  r = r.replace(/\[([^\]]+)\]/g, ':$1');
  if (r !== '/' && r.endsWith('/')) r = r.slice(0, -1);
  return r;
}

function routeToFnName(rel) {
  return 'page_' + rel
    .replace(/\.flx$/, '')
    .replace(/\\/g, '/')
    .replace(/[\[\]]/g, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_');
}

function generate(routes) {
  const lines = [];
  lines.push('; _app.fl — 자동 생성. 직접 수정 금지.');
  lines.push(`; 생성: ${new Date().toISOString()}`);
  lines.push('');

  // 각 페이지 함수 인라인
  for (const r of routes) {
    const src = fs.readFileSync(r.file, 'utf8').trim();
    lines.push(`; ── ${r.file} ──`);
    const renamed = src.replace(
      /\(defn render \[req\]/,
      `(defn ${r.fnName} [req]`
    );
    lines.push(renamed);
    lines.push('');
  }

  // server-get/server-post 방식으로 라우트 등록
  for (const r of routes) {
    const method = r.route.startsWith('/api/') ? 'server-get' : 'server-get';
    lines.push(`(${method} "${r.route}" "${r.fnName}")`);
  }
  lines.push('');
  lines.push(`(println "FL-Front v0.1 — http://localhost:${PORT}")`);
  lines.push(`(server-start ${PORT})`);

  return lines.join('\n');
}

const routes = scanPages(PAGES_DIR);
console.log('FL-Front 빌드...');
routes.forEach(r => console.log(`  ${r.route.padEnd(22)} → ${r.file}`));

fs.writeFileSync(OUT_FILE, generate(routes), 'utf8');
console.log(`✅ _app.fl 생성 완료 (${routes.length}개 라우트)`);
