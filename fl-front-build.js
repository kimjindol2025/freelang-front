#!/usr/bin/env node
// fl-front-build.js — pages/*.flx 스캔 → _app.fl 단일 파일 생성 (load 불필요)

const fs             = require('fs');
const path           = require('path');
const styleCompiler  = require('./style-compiler');
const islandCompiler = require('./island-compiler');

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

function generate(routes, bindings = []) {
  const lines = [];
  lines.push('; _app.fl — 자동 생성. 직접 수정 금지.');
  lines.push(`; 생성: ${new Date().toISOString()}`);
  lines.push('');

  // CSS 스타일 바인딩 — (define card "card__6486")
  if (bindings.length > 0) {
    lines.push('; ── CSS 스타일 클래스 바인딩 ──');
    for (const { name, cls } of bindings) {
      const flName = name.replace(/-/g, '_');
      lines.push(`(define ${flName} "${cls}")`);
    }
    lines.push('');
  }

  // 각 페이지 함수 인라인 — (style/island/server-fn ...) 블록 처리 후 삽입
  for (const r of routes) {
    const raw = fs.readFileSync(r.file, 'utf8').trim();
    // 0) (server-fn name [] body) → (defn name [] body)
    let src = raw.replace(
      /\(server-fn\s+([\w-]+)\s+\[([^\]]*)\]/,
      '(defn $1 [$2]'
    );
    // 1) (style ...) 블록 제거 (CSS 파일로 컴파일됨)
    src = src.replace(/\(style\s+[\w-]+[^)]*\)\n?/g, '').trim();
    // 2) (island ...) 블록 컴파일
    const islands = islandCompiler.extractIslands(src);
    // 2a) 최상위 island 블록 완전 제거 (FL 런타임에서 실행 불가)
    for (const { block } of [...islands].reverse()) {
      src = src.replace(block, '');
    }
    src = src.trim();
    // 2b) HTML placeholder 교체 (ISLAND_PLACEHOLDER → <div> 마운트 포인트)
    if (islands.length > 0) {
      const { scripts } = islandCompiler.compileFileIslands(
        islands.map(i => i.block).join('\n')
      );
      const divs = islands.map((_, idx) => {
        const ast = islandCompiler.extractIslands(islands[idx].block);
        return `<div id='island-${idx}'></div>`;
      }).join('');
      // island id는 compileFileIslands가 생성한 것 사용
      const { scripts: compiledScripts } = islandCompiler.compileFileIslands(
        islands.map(i => i.block).join('\n')
      );
      const divPlaceholder = islands.map((item, idx) => {
        const nameMatch = item.block.match(/\(island\s+([\w-]+)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : `island${idx}`;
        return `<div id='island-${name}-${idx}'></div>`;
      }).join('');
      const scriptBlock = islandCompiler.FL_ISLAND_RT +
        `<script>\n${compiledScripts.join('\n')}\n</script>`;
      src = src.replace(/"ISLAND_PLACEHOLDER"/g, JSON.stringify(divPlaceholder));
      src = src.replace(/"ISLAND_SCRIPTS"/g, JSON.stringify(scriptBlock));
    }
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

// CSS DSL 컴파일
const PUBLIC_DIR = path.join(__dirname, 'public');
const { bindings } = styleCompiler.compile(PAGES_DIR, PUBLIC_DIR);
if (bindings.length > 0) {
  console.log(`  CSS: ${bindings.length}개 스타일 → public/app.css`);
  bindings.forEach(b => console.log(`    .${b.cls}  ←  ${b.name}`));
}

fs.writeFileSync(OUT_FILE, generate(routes, bindings), 'utf8');
console.log(`✅ _app.fl 생성 완료 (${routes.length}개 라우트)`);
