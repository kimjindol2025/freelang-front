#!/usr/bin/env node
// fl-front-build.js — pages/*.flx 스캔 → _app.fl 단일 파일 생성 (load 불필요)

const fs             = require('fs');
const path           = require('path');
const cp             = require('child_process');
const styleCompiler  = require('./style-compiler');
const islandCompiler = require('./island-compiler');

const PAGES_DIR   = path.join(__dirname, 'pages');
const OUT_FILE    = path.join(__dirname, '_app.fl');
const AGENTS_FILE = path.join(__dirname, 'AGENTS.md');
const PORT        = 40850;

// ══════════════════════════════════════════════════════════════
// A. 알려진 함수 목록 (AI가 써도 되는 것들)
// ══════════════════════════════════════════════════════════════
const KNOWN_STDLIB = new Set([
  // http-server
  'server_get','server_post','server_put','server_patch','server_delete',
  'server_static','server_stop','server_text','server_status','server_html',
  'server_html_cookie','server_csp_nonce','server_set_cookie',
  'server_redirect','server_redirect_cookie','server_header','server_options',
  'server_req_cookie','server_req_query','server_req_files','server_req_fields',
  'server_req_header','server_req_headers','server_req_param','server_req_params',
  'server_req_method','server_req_path','server_req_id','server_req_session_id',
  'server_wait_respond','server_hold_response','server_send_held',
  'server_on_upgrade','server_on_ws_message','server_on_ws_close',
  'ws_send_to_client','ws_close_client','server_json','server_start',
  // db
  'db_query','db_exec','db_insert','db_count','db_tables','db_create',
  'db_get','db_all','db_put','db_delete','db_close',
  // auth
  'auth_jwt_sign','auth_jwt_verify','auth_password_hash','auth_password_verify',
  'auth_csrf_token','auth_csrf_verify','html_escape','js_escape',
  // data
  'json_parse','json_str','json_stringify','str_trim','str_lines',
  'str_replace_in','str_template','str_count','regex_split',
  // fl-front 주입 헬퍼
  'form_field','url_decode','dev_error_page','not_found_handler',
  'layout','nav_link','db_migrate','db_fetch_stats',
  // core
  'defn','define','let','if','do','when','str','get','get_in',
  'first','last','rest','map','filter','reduce','length','push',
  'assoc','dissoc','nil?','not','and','or','=','not=','>','<','>=','<=',
  'str_join','str_split','println','try','catch','fn',
  'server_redirect','server_html','chart_bar','chart_line',
  'uuid_short','uuid','format_currency','number_format',
]);

// 하이픈↔언더스코어 양쪽 허용
function isKnown(name) {
  if (KNOWN_STDLIB.has(name)) return true;
  const alt = name.includes('-') ? name.replace(/-/g,'_') : name.replace(/_/g,'-');
  return KNOWN_STDLIB.has(alt);
}

// ══════════════════════════════════════════════════════════════
// B. 빌드 시 미정의 함수 감지
// ══════════════════════════════════════════════════════════════
function validateFunctions(appFlContent, routes) {
  // (fn-name ...) 패턴 추출 — defn/define/let 제외
  const callPattern = /\(([a-z][a-z0-9_-]+)[\s\n]/g;
  const CORE_KEYWORDS = new Set([
    'defn','define','let','if','do','when','and','or','not','fn',
    'try','catch','str','get','map','filter','reduce','first','last',
    'rest','push','assoc','dissoc','nil?','length','println',
  ]);
  const unknown = new Map(); // fnName → [lines]
  const lines = appFlContent.split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith(';')) return;
    let m;
    const re = /\(([a-z][a-z0-9_-]{2,})/g;
    while ((m = re.exec(line)) !== null) {
      const fn = m[1];
      if (CORE_KEYWORDS.has(fn)) continue;
      if (isKnown(fn)) continue;
      // 빌드가 자동 생성하는 내부 패턴 무시
      if (fn.endsWith('__inner') || fn.startsWith('page_')) continue;
      // JS Island 런타임 코드 무시
      if (['const','function','document','arr','obj','tag','attrs',
           'update','content','items','done','next_id','inp_val',
           'item','handler','label','style','island','atom','swap'].includes(fn)) continue;
      if (!unknown.has(fn)) unknown.set(fn, []);
      unknown.get(fn).push(i + 1);
    }
  });

  if (unknown.size === 0) return;

  const allKnown = [...KNOWN_STDLIB];
  console.log('\n\x1b[33m⚠️  [AI 경고] 미정의 함수 감지 — 런타임에서 에러 발생 가능\x1b[0m');
  for (const [fn, lineNums] of unknown) {
    // 편집거리 기반 유사 함수 제안
    const suggestions = allKnown
      .filter(k => {
        const a = fn.replace(/-/g,'_'), b = k.replace(/-/g,'_');
        if (Math.abs(a.length - b.length) > 4) return false;
        let diff = 0;
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
        return diff <= 3 || b.includes(a.slice(0,4)) || a.includes(b.slice(0,4));
      })
      .slice(0, 3);
    const hint = suggestions.length ? `  → 혹시: ${suggestions.join(', ')} ?` : '';
    console.log(`  \x1b[31m✗\x1b[0m (${fn}) — 줄 ${lineNums.slice(0,3).join(', ')}${hint}`);
  }
  console.log('');
}

// ══════════════════════════════════════════════════════════════
// C. AGENTS.md 자동 생성 (AI 세션 시작 시 읽는 컨텍스트)
// ══════════════════════════════════════════════════════════════
function generateAgentsMd(routes) {
  const routeList = routes.map(r =>
    `| \`${r.route}\` | ${r.file} |`
  ).join('\n');

  return `# FL-Front AI Context (자동 생성 — 직접 수정 금지)

> 이 파일은 \`fl-front-build.js\` 빌드 시 자동 갱신됩니다.
> AI 세션 시작 시 반드시 읽으세요.

## 핵심 규칙

- 페이지 파일: \`pages/*.flx\` — \`(defn render [req])\` 필수
- POST 처리: \`(defn render_post [req])\` 추가하면 자동 등록
- 헬퍼 파일: \`pages/_*.flx\` — 라우트 미등록, 공통 함수용
- 빌드: \`node fl-front-build.js\` → \`_app.fl\` 생성

## 주입된 헬퍼 (모든 .flx에서 바로 사용 가능)

\`\`\`lisp
; 폼 필드 읽기 — JSON + urlencoded 둘 다 지원
(form-field req "name")       ; → "홍길동" 또는 ""
(url-decode "hello+world")    ; → "hello world"

; 레이아웃 (nav 포함 공통 HTML)
(layout "페이지제목" html-content req)

; DB (SQLite)
(define DB {:type "sqlite" :path "data/app.db"})
(db-exec DB "CREATE TABLE IF NOT EXISTS ..." [])
(db-query DB "SELECT * FROM notes" [])   ; → [{...}]

; 응답
(server-html "...html...")       ; → 200 HTML 응답
(server-json {:ok true})         ; → 200 JSON 응답
(server-redirect "/path")        ; → 302 리다이렉트
(server_status 404 "html...")    ; → 커스텀 상태코드

; 요청 파싱
(get req "body")                 ; → 파싱된 맵 (JSON POST)
(server-req-path req)            ; → "/notes"
(server-req-method req)          ; → "GET" | "POST"
(server-req-query req "key")     ; → "value"
(server-req-param req "id")      ; → URL 파라미터 :id
(server-req-header req "content-type")

; 에러 (개발 시 브라우저에 오버레이 표시)
(dev-error-page "/route" "에러 메시지")
\`\`\`

## 절대 쓰지 말 것 (존재하지 않는 함수)

| ❌ 쓰면 안 됨 | ✅ 올바른 함수 |
|-------------|-------------|
| \`url-decode\` | → 주입된 \`(url-decode s)\` 사용 |
| \`form-field req key\` | → 주입된 \`(form-field req key)\` 사용 |
| \`server-status\` | → \`server_status\` (언더스코어) |
| \`server-sse\` | → ❌ 미지원 |
| \`server-req-body\` | → ❌ 미지원, \`(get req "body")\` 사용 |
| \`str-split\` | → \`regex_split str pattern\` |
| \`str-includes?\` | → \`arr-includes?\` (배열용만 있음) |

## 페이지 패턴

\`\`\`lisp
; GET 전용
(defn render [req]
  (server-html (layout "제목" "<p>내용</p>" req)))

; GET + POST
(defn render [req]
  (let [items (db-query DB "SELECT * FROM items" [])]
    (server-html (layout "목록" (str "<ul>" ...) req))))

(defn render_post [req]
  (let [name (form-field req "name")]
    (db-exec DB "INSERT INTO items (name) VALUES (?)" [name])
    (server-redirect "/items")))

; 동적 라우트 (pages/users/[id].flx)
(defn render [req]
  (let [id (server-req-param req "id")]
    (server-html (layout "유저" (str "ID: " id) req))))
\`\`\`

## 현재 등록된 라우트

| 경로 | 파일 |
|------|------|
${routeList}

## 네이밍 규칙

- FreeLang stdlib: \`snake_case\` (server_req_method, db_query)
- 주입 헬퍼: \`kebab-case\` (form-field, url-decode, dev-error-page)
- 페이지 핸들러: \`render\` / \`render_post\` (빌드 시 자동 rename)
`;
}


function scanPages(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes  = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath  = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      routes.push(...scanPages(fullPath, relPath));
    } else if (entry.name.endsWith('.flx') && !entry.name.startsWith('_')) {
      // _ 접두사 파일은 헬퍼 — 라우트로 등록 안 함
      routes.push({
        route:  fileToRoute(relPath),
        fnName: routeToFnName(relPath),
        file:   'pages/' + relPath,
      });
    }
  }
  return routes;
}

// _ 접두사 헬퍼 파일 스캔 (최상위 pages/ 만 — 하위 폴더 헬퍼는 불필요)
// 헬퍼 의존성 순서: layout → db → auth → error → charts → 나머지
const HELPER_ORDER = ['_layout', '_db', '_auth', '_error', '_charts'];

function scanHelpers(dir) {
  const helpers = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.flx') && entry.name.startsWith('_')) {
      helpers.push(path.join(dir, entry.name));
    }
  }
  helpers.sort((a, b) => {
    const ai = HELPER_ORDER.findIndex(o => path.basename(a).startsWith(o));
    const bi = HELPER_ORDER.findIndex(o => path.basename(b).startsWith(o));
    const ao = ai === -1 ? 999 : ai;
    const bo = bi === -1 ? 999 : bi;
    return ao - bo;
  });
  return helpers;
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

// ── 개발 모드 HMR 클라이언트 스크립트 ──
const HMR_SCRIPT = `<script>
(function(){
  var es = new EventSource('/~hmr');
  es.onmessage = function(e){ if(e.data==='reload') location.reload(); };
  es.onerror = function(){ setTimeout(function(){ location.reload(); }, 2000); };
})();
</script>`;

// ── 에러 오버레이 HTML ──
function errorOverlayHtml(route, err) {
  const msg = String(err).replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Error — FL-Front</title>
<style>body{margin:0;font-family:monospace;background:#0d0d0d;color:#fff}
.box{max-width:860px;margin:60px auto;padding:40px}
.tag{display:inline-block;background:#ef4444;color:white;font-size:.75rem;
  padding:4px 10px;border-radius:4px;margin-bottom:16px;font-weight:700}
h1{font-size:1.4rem;margin:0 0 24px;color:#fca5a5}
pre{background:#1a1a1a;border:1px solid #333;border-radius:8px;
  padding:24px;overflow-x:auto;font-size:.85rem;line-height:1.6;color:#f87171}
.route{color:#9ca3af;font-size:.9rem;margin-bottom:8px}</style>
</head><body><div class='box'>
<span class='tag'>Runtime Error</span>
<div class='route'>GET ${route}</div>
<h1>서버 오류가 발생했습니다</h1>
<pre>${msg}</pre>
</div></body></html>`;
}

// ── 공통 헬퍼 — _app.fl 상단에 주입 ──
const INJECTED_HELPERS = `
; ── fl-front 내장 헬퍼 (자동 주입) ──

; form-field: JSON + urlencoded 둘 다 지원
(defn form-field [req key]
  (let [raw (get req "body")]
    (if (= raw nil)
      ""
      (let [val (get raw key)]
        (if (= val nil) "" (str val))))))

; url-decode: + → 공백 처리
(defn url-decode [s]
  (if (= s nil) ""
    (str-replace-in (str s) "+" " ")))

; 에러 오버레이 HTML 렌더러 — AI 친화적 메시지 포함
(defn dev-error-page [route msg]
  (let [hint (if (> (str-count (str msg) "not found") 0)
               (str "<div style='background:#1c1917;border:1px solid #78350f;border-radius:8px;padding:16px;margin-top:16px'>"
                    "<div style='color:#fbbf24;font-size:.8rem;font-weight:700;margin-bottom:8px'>💡 AI 힌트</div>"
                    "<div style='color:#fde68a;font-size:.85rem;line-height:1.6'>"
                    "함수명 오타 가능성 있음.<br>"
                    "올바른 목록: <code>AGENTS.md</code> 참고<br>"
                    "server_ 함수는 언더스코어(snake_case) 사용<br>"
                    "예: server-html → server_html ❌, server-html ✅"
                    "</div></div>")
               "")]
    (server_status 500
      (str "<!DOCTYPE html><html><head><meta charset='utf-8'>"
           "<title>Error — FL-Front</title>"
           "<style>body{margin:0;font-family:monospace;background:#0d0d0d;color:#fff}"
           ".box{max-width:860px;margin:60px auto;padding:40px}"
           ".tag{display:inline-block;background:#ef4444;color:white;font-size:.75rem;"
           "padding:4px 10px;border-radius:4px;margin-bottom:16px;font-weight:700}"
           "h1{font-size:1.4rem;margin:0 0 16px;color:#fca5a5}"
           "pre{background:#1a1a1a;border:1px solid #333;border-radius:8px;"
           "padding:24px;overflow-x:auto;font-size:.85rem;line-height:1.6;color:#f87171}"
           ".route{color:#9ca3af;font-size:.85rem;margin-bottom:8px}"
           "code{background:#292524;padding:2px 6px;border-radius:3px;color:#fde68a}"
           "</style>"
           "</head><body><div class='box'>"
           "<span class='tag'>Runtime Error</span>"
           "<div class='route'>" route "</div>"
           "<h1>서버 오류가 발생했습니다</h1>"
           "<pre>" msg "</pre>"
           hint
           "</div></body></html>"))))

; 404 핸들러
(defn not_found_handler [req]
  (server_status 404
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>404 — 페이지를 찾을 수 없음 — FreeLang Front</title>
<style>body{font-family:sans-serif;margin:0;background:#f9fafb}
.box{max-width:480px;margin:120px auto;text-align:center;padding:24px}
h1{font-size:4rem;margin:0;color:#6366f1}p{color:#6b7280}
a{color:#6366f1;text-decoration:none;font-weight:600}</style></head>
<body><div class='box'><h1>404</h1>
<p>요청하신 페이지를 찾을 수 없습니다.</p>
<a href='/'>← 홈으로</a></div></body></html>"))
`;

function generate(routes, bindings = [], helpers = []) {
  const lines = [];
  lines.push('; _app.fl — 자동 생성. 직접 수정 금지.');
  lines.push(`; 생성: ${new Date().toISOString()}`);
  lines.push('');

  // ── 내장 헬퍼 주입 (form-field, url-decode, not_found_handler) ──
  lines.push(INJECTED_HELPERS);
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

  // 헬퍼 파일 (_*.flx) — style 블록 제거 후 먼저 삽입
  if (helpers.length > 0) {
    lines.push('; ── 레이아웃·헬퍼 함수 ──');
    for (const helperPath of helpers) {
      const raw = fs.readFileSync(helperPath, 'utf8').trim();
      // style 블록 제거 (헬퍼는 Critical CSS 인라인 불필요, app.css에 포함됨)
      const src = raw.replace(/\(style\s+[\w-]+[^)]*\)\n?/g, '').trim();
      lines.push(`; ── ${path.basename(helperPath)} ──`);
      lines.push(src);
      lines.push('');
    }
  }

  // 각 페이지 함수 인라인 — (style/island/server-fn ...) 블록 처리 후 삽입
  for (const r of routes) {
    const raw = fs.readFileSync(r.file, 'utf8').trim();
    // 0) (server-fn name [] body) → (defn name [] body)
    let src = raw.replace(
      /\(server-fn\s+([\w-]+)\s+\[([^\]]*)\]/,
      '(defn $1 [$2]'
    );
    // 1) (style ...) 블록 처리 — Critical CSS 인라인 후 블록 제거
    const { css: criticalCss, rawCss, bindings: pageBnd } = styleCompiler.compilePageCSS(r.file);
    if (criticalCss) {
      // <link rel='stylesheet' href='/public/app.css'> → <style>...</style> 교체 (레거시 패턴)
      src = src.replace(
        /"<link rel='stylesheet' href='\/public\/app\.css'>"/,
        JSON.stringify(criticalCss)
      );
    }
    src = src.replace(/\(style\s+[\w-]+[^)]*\)\n?/g, '').trim();
    // layout 호출 content 앞에 Critical CSS <style> 태그 주입
    if (rawCss) {
      const styleTag = JSON.stringify(`<style>${rawCss}</style>`);
      src = src.replace(
        /(\(layout\s+"[^"]+"\s+\(str)/,
        `$1 ${styleTag}`
      );
    }
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
    let renamed = src.replace(
      /\(defn render \[req\]/,
      `(defn ${r.fnName}__inner [req]`
    );
    // render_post 함수도 있으면 fnName_post 로 rename
    renamed = renamed.replace(
      /\(defn render_post \[req\]/,
      `(defn ${r.fnName}_post__inner [req]`
    );
    lines.push(renamed);
    // 에러 래핑 핸들러 생성
    lines.push(`(defn ${r.fnName} [req]`);
    lines.push(`  (try (${r.fnName}__inner req)`);
    lines.push(`    (catch $err (dev-error-page "${r.route}" (str $err)))))`);
    const rawSrcCheck = fs.readFileSync(r.file, 'utf8');
    if (rawSrcCheck.includes('(defn render_post [req]')) {
      lines.push(`(defn ${r.fnName}_post [req]`);
      lines.push(`  (try (${r.fnName}_post__inner req)`);
      lines.push(`    (catch $err (dev-error-page "${r.route} [POST]" (str $err)))))`);
    }
    lines.push('');
  }


  // server-get/server-post 라우트 등록
  for (const r of routes) {
    lines.push(`(server-get "${r.route}" "${r.fnName}")`);
    const rawSrc = fs.readFileSync(r.file, 'utf8');
    if (rawSrc.includes('(defn render_post [req]')) {
      lines.push(`(server-post "${r.route}" "${r.fnName}_post")`);
    }
  }
  // 와일드카드 404 핸들러 — 마지막에 등록
  lines.push('(server-get "/*" "not_found_handler")');
  lines.push('');
  lines.push(`(println "FL-Front v0.1 — http://localhost:${PORT}")`);
  lines.push(`(server-start ${PORT})`);

  return lines.join('\n');
}

const routes  = scanPages(PAGES_DIR);
const helpers = scanHelpers(PAGES_DIR);
console.log('FL-Front 빌드...');
routes.forEach(r => console.log(`  ${r.route.padEnd(22)} → ${r.file}`));
if (helpers.length > 0) {
  helpers.forEach(h => console.log(`  [헬퍼] ${path.basename(h)}`));
}

// CSS DSL 컴파일
const PUBLIC_DIR = path.join(__dirname, 'public');
const { bindings } = styleCompiler.compile(PAGES_DIR, PUBLIC_DIR);
if (bindings.length > 0) {
  console.log(`  CSS: ${bindings.length}개 스타일 → public/app.css`);
  bindings.forEach(b => console.log(`    .${b.cls}  ←  ${b.name}`));
}

const appContent = generate(routes, bindings, helpers);
fs.writeFileSync(OUT_FILE, appContent, 'utf8');

// A. 빌드 시 미정의 함수 감지
validateFunctions(appContent, routes);

// C. AGENTS.md 자동 생성
fs.writeFileSync(AGENTS_FILE, generateAgentsMd(routes), 'utf8');

console.log(`✅ _app.fl 생성 완료 (${routes.length}개 라우트, 헬퍼 ${helpers.length}개)`);
console.log(`✅ AGENTS.md 갱신 완료`);
