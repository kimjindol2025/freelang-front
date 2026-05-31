#!/usr/bin/env node
// fl-front-build.js — pages/*.flx 스캔 → _app.fl 단일 파일 생성
// Phase 5: 파일 해시 캐싱으로 미변경 페이지 스킵

const fs             = require('fs');
const path           = require('path');
const cp             = require('child_process');
const crypto         = require('crypto');
const styleCompiler  = require('./style-compiler');
const islandCompiler = require('./island-compiler');

const CACHE_FILE = path.join(__dirname, '.build-cache.json');

// 빌드 캐시 로드/저장
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8'); } catch {}
}
function fileHash(p) {
  try { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 8); }
  catch { return ''; }
}

const PAGES_DIR   = path.join(__dirname, 'pages');

// (style ...) 블록을 괄호 깊이 추적으로 정확히 제거
function removeStyleBlocks(src) {
  let result = '';
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('(style ', i);
    if (idx === -1) { result += src.slice(i); break; }
    result += src.slice(i, idx);
    let depth = 0, j = idx;
    while (j < src.length) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) { j++; break; } }
      j++;
    }
    // 뒤따르는 개행도 제거
    while (j < src.length && (src[j] === '\n' || src[j] === '\r')) j++;
    i = j;
  }
  return result;
}
const OUT_FILE    = path.join(__dirname, '_app.fl');
const AGENTS_FILE = path.join(__dirname, 'AGENTS.md');
const PORT        = 40850;

// ══════════════════════════════════════════════════════════════
// A. FreeLang stdlib 함수 목록 자동 로드 (빌드 시 1회)
// ══════════════════════════════════════════════════════════════
const BOOTSTRAP = '/home/kimjin/freelang-v11/bootstrap.js';

function loadFreeLangStdlib() {
  try {
    const out = cp.execSync(`node ${BOOTSTRAP} ls-fns 2>/dev/null`, { timeout: 8000 }).toString();
    // 출력 패턴: "  func_name [args] → ..." (2칸 들여쓰기)
    const names = [...out.matchAll(/^ {2}([\w-]+)[\s[→]/gm)].map(m => m[1]);
    return new Set(names);
  } catch {
    return new Set(); // 로드 실패 시 빈 Set (모든 함수 허용)
  }
}

// fl-front 자체 주입 헬퍼 (stdlib에 없는 것만)
const FL_FRONT_HELPERS = new Set([
  'form_field','form-field','form_data','form-data','form_get','form-get','form_validate','form-validate',
  'url_decode','url-decode',
  'dev_error_page','dev-error-page','not_found_handler','not-found-handler',
  'layout','layout-html','nav_link','nav-link',
  'db_migrate','db-migrate','db_fetch_stats','db-fetch-stats',
  'chart_bar','chart-bar','chart_line','chart-line',
  'arr_join','arr-join','h',
  // 빌드 타임에 변환되는 특수 구문
  'island','server-fn','server_fn',
  // core FreeLang
  'defn','define','let','if','do','when','str','get','get_in','get-in',
  'first','last','rest','map','filter','reduce','length','push',
  'assoc','dissoc','nil?','not','and','or','=','not=','>','<','>=','<=',
  'println','try','catch','fn','inc','dec','swap!','reset!','atom','deref',
  'server_start','server-start','server_html','server-html',
  'server_json','server-json','server_redirect','server-redirect',
  'uuid','uuid_short','uuid-short',
  // Island 전용 런타임 함수
  'dispatch','get-store','get_store',
  'fetch!','fetch-post!',
  // 서버 req 헬퍼
  'server-req-param','server-req-query','server-req-json',
  'server_req_param','server_req_query','server_req_json',
  // INJECTED_HELPERS에서 자동 주입되는 함수들
  'round','str-slice','str_slice','map-indexed','map_indexed',
  'empty?','h!','h-attrs','arr-join','arr_join',
]);

const KNOWN_STDLIB = loadFreeLangStdlib();
// 헬퍼 추가
for (const fn of FL_FRONT_HELPERS) KNOWN_STDLIB.add(fn);

// 하이픈↔언더스코어 양쪽 허용
function isKnown(name) {
  if (KNOWN_STDLIB.has(name)) return true;
  const alt = name.includes('-') ? name.replace(/-/g,'_') : name.replace(/_/g,'-');
  return KNOWN_STDLIB.has(alt);
}

// ══════════════════════════════════════════════════════════════
// B. 빌드 시 미정의 함수 감지 — 원본 .flx 파일 기준 (file:line 정확)
// ══════════════════════════════════════════════════════════════

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({length: m + 1}, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function suggestFn(fn, knownSet) {
  const norm = fn.replace(/-/g, '_');
  const threshold = Math.max(2, Math.floor(fn.length * 0.45));
  return [...knownSet]
    .map(k => ({ k, d: levenshtein(norm, k.replace(/-/g, '_')) }))
    .filter(x => x.d <= threshold)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.k);
}

const FALSE_POS = new Set([
  'snake_case','datetime','label','style','nil','null','true','false',
  'table','column','select','insert','update','delete','where','order',
  'auto','fill','minmax','repeat','grid','flex','block','inline',
  'search','event','card','index','server','client','text','html',
  'string','function','handler','auto-fill','object','class','extends',
  'hover','focus','active','disabled','checked','visited',
  'translate','rotate','scale','linear','radial','solid','dashed',
]);

function validateFunctions(routes, helpers, bindings) {
  const CORE_KEYWORDS = new Set([
    'defn','define','let','if','do','when','and','or','not','fn',
    'try','catch','str','get','map','filter','reduce','first','last',
    'rest','push','assoc','dissoc','nil?','length','println','inc','dec',
    'swap!','reset!','atom','deref','str-join','not=','zero?','pos?',
  ]);

  // 알려진 함수 세트 구성 (stdlib + 헬퍼 + CSS 바인딩)
  const known = new Set(KNOWN_STDLIB);
  for (const b of (bindings || [])) {
    known.add(b.name);
    known.add(b.name.replace(/-/g, '_'));
  }

  const allFiles = [...helpers, ...routes.map(r => r.file)];

  // 1패스: 모든 .flx 파일에서 defn/define/server-fn 수집
  const defined = new Set();
  for (const f of allFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\(defn\s+([\w-]+)/g))       defined.add(m[1]);
    for (const m of src.matchAll(/\(define\s+([\w-]+)/g))     defined.add(m[1]);
    for (const m of src.matchAll(/\(server-fn\s+([\w-]+)/g))  defined.add(m[1]);
  }

  function isKnownFn(fn) {
    if (known.has(fn) || defined.has(fn)) return true;
    const alt = fn.includes('-') ? fn.replace(/-/g,'_') : fn.replace(/_/g,'-');
    return known.has(alt) || defined.has(alt);
  }

  // 2패스: 각 원본 .flx 파일에서 미정의 함수 감지
  const issues = [];
  for (const f of allFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const fileName = path.basename(f);
    const strippedLines = src
      .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '"__STR__"')  // 문자열 먼저 (내부 ; 보호)
      .replace(/;[^\n]*/g, '')                           // 그 다음 주석 제거
      .split('\n');

    for (let li = 0; li < strippedLines.length; li++) {
      for (const m of strippedLines[li].matchAll(/\(([a-z][a-z0-9_-]{2,}[!?]?)/g)) {
        const fn = m[1];
        if (CORE_KEYWORDS.has(fn)) continue;
        if (isKnownFn(fn)) continue;
        if (fn.endsWith('__inner') || fn.startsWith('page_')) continue;
        if (FALSE_POS.has(fn)) continue;
        issues.push({ file: fileName, line: li + 1, fn });
      }
    }
  }

  // 중복 제거 (같은 파일+함수명 첫 발생만)
  const seen = new Set();
  const unique = issues.filter(i => {
    const k = `${i.file}:${i.fn}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  if (unique.length === 0) { console.log('  ✅ 미정의 함수 없음'); return; }

  console.log('\n\x1b[33m⚠️  [경고] 미정의 함수 — 런타임 에러 가능\x1b[0m');
  for (const { file, line, fn } of unique) {
    const suggestions = suggestFn(fn, known);
    const hint = suggestions.length
      ? `\n      → \x1b[36m${suggestions.join(', ')}\x1b[0m`
      : '';
    console.log(`  \x1b[31m✗\x1b[0m ${file}:${line} — '${fn}' 정의 없음${hint}`);
  }
  console.log('');
}

// ══════════════════════════════════════════════════════════════
// C. AGENTS.md 자동 생성 (AI 세션 시작 시 읽는 컨텍스트)
// ══════════════════════════════════════════════════════════════
function scanTypeAnnotations(routes, helpers) {
  const types = [];
  const allFiles = [...helpers, ...routes.map(r => ({ file: r.file, label: r.file }))];
  for (const { file, label } of allFiles) {
    try {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^;\s*@type\s+(.+)$/gm)) {
        types.push({ file: path.basename(file), annotation: m[1].trim() });
      }
    } catch {}
  }
  return types;
}

function generateAgentsMd(routes, helpers = []) {
  const routeList = routes.map(r =>
    `| \`${r.route}\` | ${r.file} |`
  ).join('\n');

  const typeAnnotations = scanTypeAnnotations(routes, helpers);
  const typeSection = typeAnnotations.length > 0
    ? `\n## @type 주석 (파일에서 자동 추출)\n\n` +
      typeAnnotations.map(t => `- \`${t.file}\` — \`${t.annotation}\``).join('\n') + '\n'
    : '';

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
; HTML 빌더 (h() SSR)
(h "div" {:class btn :id "wrap"} "내용")    ; → <div class="btn__hash" id="wrap">내용</div>
(h "div" {:class card} (str child1 child2)) ; → 자식 결합
(h! "input" {:type "text" :name "q"})       ; → <input type="text" name="q">

; 배열 결합 (h() 자식 여러 개)
(arr-join (map render-fn items) "")         ; → 리스트 렌더링

; 폼 (통일 API — form-field 대신 이걸 사용)
(form-get req "name")                    ; → "홍길동" 또는 ""
(form-data req)                          ; → {"name" "홍길동" "email" "..."} 전체 맵
(form-validate req ["name" "email"])     ; → {"valid" true "errors" []}
(form-field req "name")       ; ← 레거시 (위와 동일하지만 form-get 권장)
(url-decode "hello+world")    ; → "hello world"

; 레이아웃
(layout-html "제목" html-string req)        ; CSS + SPA 라우터 포함

; DB (SQLite)
(define DB {:type "sqlite" :path "data/app.db"})
(db-query DB "SELECT * FROM t" [])          ; → [{...}]
(db-exec DB "INSERT INTO t (n) VALUES (?)" ["val"])

; 응답
(server-html "html...")       ; → 200
(server-json {:ok true})      ; → 200 JSON
(server-redirect "/path")     ; → 302
(server_status 404 "html...") ; → 404

; 요청
(get req "body")              ; POST body 맵
(server-req-param req "id")   ; :id URL 파라미터
(server-req-query req "q")    ; ?q= 쿼리스트링

; Island 글로벌 store
; → Island 런타임(_fl)에서만 동작
; (dispatch "key" val)        ; store 업데이트
; (get-store "key")           ; store 읽기
; (island X [:watch "key"] …) ; 반응형 Island

; Island 비동기 fetch (Island 블록 안에서만 사용)
; (fetch! "/api/users" (fn [data] (reset! items data)))          ; GET → JSON
; (fetch-post! "/api/save" {"name" "홍"} (fn [res] ...))         ; POST JSON → JSON
; 에러 시 /~errors 자동 수집 + 터미널 출력

; SPA 링크
(h "a" {:href "/path" :data-spa "1"} "이동") ; 새로고침 없이 전환
\`\`\`

## 절대 쓰지 말 것 (존재하지 않는 함수 + 자주 틀리는 것)

| ❌ 쓰면 안 됨 | ✅ 올바른 함수 |
|-------------|-------------|
| \`server-req-body\` | \`(get req "body")\` |
| \`server-html\` | \`server_html\` (언더스코어) |
| \`str-split\` | \`regex_split str pattern\` |
| \`str-includes?\` | \`(> (str-count s sub) 0)\` |
| \`nil?\` | \`(= x nil)\` |
| \`map-indexed\` | \`(map fn arr)\` + index 수동 |
| \`string?\` | ❌ 없음 |
| \`server-sse\` | ❌ 미지원 |
| \`(catch $e [])\` | \`(catch $e nil)\` → 빈 벡터 반환은 에러 |

## FreeLang 변수명 규칙 (반드시 준수)

- **소문자만** — \`api-base\` ✅, \`API\` ❌ (대문자 심볼 파싱 에러)
- **하이픈 허용** — \`my-var\`, \`api-base\` 모두 가능
- **underscore도 허용** — \`my_var\`, \`api_base\`
- **stdlib**: snake_case (\`server_html\`, \`db_query\`)
- **주입 헬퍼**: kebab-case (\`form-field\`, \`arr-join\`, \`dispatch-html\`)

## h() 괄호 디버깅 팁

중첩 h()를 쓸 때 괄호 불균형이 자주 발생합니다:
\`\`\`bash
# 빌드 전 반드시 검증
python3 /home/kimjin/freelang-v11/scripts/check-parens.py pages/mypage.flx
\`\`\`

복잡한 중첩은 defn으로 분리:
\`\`\`lisp
; ❌ 한 번에 쓰면 괄호 추적 어려움
(h "div" {} (h "ul" {} (arr-join (map (fn [i] (h "li" {} ...)) items) "")))

; ✅ 헬퍼 함수로 분리
(defn render-item [i] (h "li" {} (get i "name")))
(h "div" {} (h "ul" {} (arr-join (map render-item items) "")))
\`\`\`

## 페이지 패턴

\`\`\`lisp
; GET — h() 사용
(defn render [req]
  (layout-html "제목"
    (h "div" {:class card}
      (h "p" {} "내용"))
    req))

; GET + POST
(defn render [req]
  (let [items (db-query DB "SELECT * FROM t" [])]
    (layout-html "목록"
      (h "ul" {}
        (arr-join (map (fn [i] (h "li" {} (get i "name"))) items) ""))
      req)))

(defn render_post [req]
  (let [name (form-field req "name")]
    (db-exec DB "INSERT INTO t (name) VALUES (?)" [name])
    (server-redirect "/list")))

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

## @type 주석 컨벤션 (AI 타입 힌트)

파일 상단에 아래 형식으로 작성하면 AGENTS.md에 자동 포함됩니다:
\`\`\`lisp
; @type user: {id: int, name: string, email: string}
; @type req.params.id: string
; @type items: [{id: int, title: string, done: bool}]
\`\`\`
${typeSection}
## AI 디버그 API

\`\`\`bash
# 현재 앱 상태 (라우트, 에러, 소스맵) 한 번에 조회
curl http://localhost:40851/~ai | python3 -m json.tool

# 브라우저 에러만
curl http://localhost:40851/~errors
\`\`\`
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

; ── 누락 stdlib 보완 ──
; nil? — FreeLang에 없는 함수 보완
(defn nil? [x] (= x nil))

; round — 반올림 (% 연산자로 소수점 추출)
(defn round [n]
  (let [frac (% n 1)]
    (if (>= frac 0.5)
      (+ (- n frac) 1)
      (- n frac))))

; str-slice — 부분 문자열 추출 (regex_split "" 으로 char 분리)
(defn str-slice [s start end]
  (let [chars (regex_split (str s) "")
        idx   (atom 0)]
    (arr-join
      (filter
        (fn [_c]
          (let [i (deref idx)
                _ (swap! idx (fn [n] (+ n 1)))]
            (and (>= i start) (< i end))))
        chars)
      "")))

; map-indexed — 인덱스 포함 map (atom 카운터 방식)
(defn map-indexed [f arr]
  (let [idx (atom 0)]
    (map
      (fn [item]
        (let [i (deref idx)
              _ (swap! idx (fn [n] (+ n 1)))]
          (f i item)))
      arr)))

; server-html alias — snake_case 혼동 방지
(defn server-html [html] (server_html html))

; empty? — 빈 컬렉션 체크
(defn empty? [x] (if (= x nil) true (= (length x) 0)))

; form-field: JSON + urlencoded 둘 다 지원
(defn form-field [req key]
  (let [raw (get req "body")]
    (if (= raw nil)
      ""
      (let [val (get raw key)]
        (if (= val nil) "" (str val))))))

; form-data — body 전체 맵 반환
(defn form-data [req]
  (let [body (get req "body")]
    (if (= body nil) {} body)))

; form-get — 특정 키 읽기 (없으면 "")
(defn form-get [req key]
  (let [body (get req "body")]
    (if (= body nil) ""
      (let [v (get body key)]
        (if (= v nil) "" (str v))))))

; form-validate — 필수 키 검증 → {"valid" true/false "errors" [...누락키]}
(defn form-validate [req keys]
  (let [missing (filter keys (fn [k] (= (form-get req k) "")))]
    {"valid" (= (length missing) 0)
     "errors" missing}))

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

; ── h() SSR — HTML 문자열 빌더 ──
; 사용: (h "div" {:class btn :id "main"} "내용")
; 사용: (h "div" {:class card} (h "p" {} "자식"))
; 자식이 배열이면 자동으로 결합

(defn arr-join [arr sep]
  (reduce
    (fn [acc x] (if (= acc "") (str x) (str acc sep x)))
    "" arr))

; 큰따옴표 문자 — json_str("x") = "\"x\"", split by "x" → ['"', '"']
(define DQUOTE (first (regex_split (json_str "x") "x")))

(defn h-attrs [attrs]
  (if (= attrs nil) ""
    (let [pairs (map-entries attrs)]
      (arr-join
        (filter (fn [s] (not (= s "")))
          (map (fn [pair]
            (let [k (get pair 0)
                  v (get pair 1)]
              (if (= v nil) ""
                (str " " k "=" DQUOTE (str v) DQUOTE))))
            pairs))
        ""))))

(defn h [tag attrs content]
  (let [a (h-attrs attrs)
        c (if (= content nil) "" (str content))]
    (str "<" tag a ">" c "</" tag ">")))

; 자기닫힘 태그용
(defn h! [tag attrs]
  (str "<" tag (h-attrs attrs) ">"))

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

function generate(routes, bindings = [], helpers = [], appCss = '') {
  const lines = [];
  const sourceMap = {}; // "startLine-endLine" → "pages/X.flx"
  lines.push('; _app.fl — 자동 생성. 직접 수정 금지.');
  lines.push(`; 생성: ${new Date().toISOString()}`);
  lines.push('');

  // ── 내장 헬퍼 주입 (form-field, url-decode, not_found_handler) ──
  lines.push(INJECTED_HELPERS);
  lines.push('');

  // CSS 스타일 바인딩 — snake_case + kebab-case 둘 다 정의
  if (bindings.length > 0) {
    lines.push('; ── CSS 스타일 클래스 바인딩 ──');
    for (const { name, cls } of bindings) {
      const snakeName = name.replace(/-/g, '_');
      lines.push(`(define ${snakeName} "${cls}")`);
      // 하이픈 이름도 alias (FreeLang에서 -는 변수명에 허용됨)
      if (name !== snakeName) {
        lines.push(`(define ${name} "${cls}")`);
      }
    }
    lines.push('');
  }

  // 헬퍼 파일 (_*.flx) — style 블록 제거 후 먼저 삽입
  if (helpers.length > 0) {
    lines.push('; ── 레이아웃·헬퍼 함수 ──');
    for (const helperPath of helpers) {
      let raw = fs.readFileSync(helperPath, 'utf8').trim();
      // _layout.flx: GLOBAL-CSS 앞에 모던 CSS 토큰 주입 + app.css 병합
      if (path.basename(helperPath) === '_layout.flx') {
        const BASE_CSS = `
/* ━━━ OKLCH + Relative Colors + light-dark() 다크모드 ━━━ */
:root{
  color-scheme: light dark;

  /* OKLCH 팔레트 — 지각적으로 균일한 색상 */
  --c-primary:   oklch(0.55 0.22 264);
  --c-primary-d: oklch(from var(--c-primary) calc(l - 0.07) c h);
  --c-primary-l: oklch(from var(--c-primary) 0.94 0.05 h);
  --c-success:   oklch(0.55 0.17 145);
  --c-warning:   oklch(0.62 0.15 76);
  --c-danger:    oklch(0.50 0.20 25);

  /* light-dark() — 다크모드 자동 전환 */
  --c-bg:      light-dark(oklch(0.97 0.01 264), oklch(0.12 0.015 264));
  --c-surface: light-dark(oklch(1 0 0),          oklch(0.17 0.012 264));
  --c-border:  light-dark(oklch(0.91 0.01 264),  oklch(0.27 0.015 264));
  --c-text:    light-dark(oklch(0.17 0.01 264),  oklch(0.92 0.005 264));
  --c-muted:   light-dark(oklch(0.65 0.01 264),  oklch(0.52 0.01 264));
  --c-nav-bg:  light-dark(oklch(0.17 0.03 264),  oklch(0.10 0.02 264));

  --radius-sm:8px;--radius-md:12px;
  --shadow-sm:0 1px 3px oklch(0 0 0 / .07);
  --shadow-md:0 4px 16px oklch(0 0 0 / .12);
  --ease-spring:linear(0,0.009,0.035 2.1%,0.141,0.281 6.7%,0.723 12.9%,0.938 16.7%,1.017,1.06,1.081 21%,1.09,1.088 24.6%,1.081,1.037 33.3%,1.009 38.3%,1);
  --ease-bounce:linear(0,0.063,0.25,0.563,1.001,1.199 18.2%,1.249,1.27,1.274,1.25 25%,1.008 32.8%,0.96,0.944 37%,0.944 38.6%,0.96,1.001 46.6%,1.015,1.016 52.5%,1.001 56.6%,0.994,1);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--c-bg);color:var(--c-text);min-height:100dvh}
h1,h2,h3{text-wrap:balance;overflow-wrap:break-word}
p{text-wrap:pretty;overflow-wrap:break-word;margin:8px 0;line-height:1.6}
a{color:var(--c-primary);text-decoration:none;transition:color .15s}
a:hover{text-decoration:underline;color:var(--c-primary-d)}
.card{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-md);padding:20px;box-shadow:var(--shadow-sm);margin-bottom:16px;transition:box-shadow .3s var(--ease-spring),transform .3s var(--ease-spring)}
.card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:.76rem;font-weight:600}
.badge-primary{background:var(--c-primary-l);color:var(--c-primary-d)}
.badge-success{background:#dcfce7;color:var(--c-success)}
.badge-warning{background:#fef3c7;color:var(--c-warning)}
.badge-danger{background:#fee2e2;color:var(--c-danger)}
.table-wrap{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow-sm)}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:10px 14px;font-size:.82rem;font-weight:600;color:#6b7280;border-bottom:1px solid var(--c-border);text-align:left}
td{padding:11px 14px;font-size:.9rem;border-bottom:1px solid #f1f3f6;transition:background .15s}
tr:last-child td{border-bottom:none}
tr:hover td{background:#f5f7ff}
tr:has(input[type=checkbox]:checked) td{background:color-mix(in srgb,var(--c-primary) 6%,transparent)}
form{display:grid;gap:14px;max-width:520px}
label{font-size:.88rem;font-weight:600;display:block;margin-bottom:4px;transition:color .15s}
.field:has(input:focus) label,.field:has(textarea:focus) label,.field:has(select:focus) label{color:var(--c-primary)}
input,select{font:inherit;padding:9px 12px;border:1px solid #d1d5db;border-radius:var(--radius-sm);width:100%;background:var(--c-surface);color:var(--c-text);transition:all .18s}
textarea{font:inherit;padding:9px 12px;border:1px solid #d1d5db;border-radius:var(--radius-sm);width:100%;background:var(--c-surface);color:var(--c-text);transition:all .18s;resize:none;min-height:90px;field-sizing:content;overflow-y:auto;max-height:360px}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--c-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-primary) 15%,transparent)}
form:has(input:invalid:not(:placeholder-shown)) [type=submit]{opacity:.55;cursor:not-allowed}
button,[type=submit]{font:inherit;background:var(--c-primary);color:#fff;border:none;border-radius:var(--radius-sm);padding:10px 22px;font-weight:600;cursor:pointer;width:fit-content;transition:transform .35s var(--ease-spring),background .18s,box-shadow .35s var(--ease-spring)}
button:hover,[type=submit]:hover{background:var(--c-primary-d);transform:translateY(-2px);box-shadow:0 4px 12px rgba(99,102,241,.3)}
button:active,[type=submit]:active{transform:translateY(0);box-shadow:none}
button.secondary{background:#f3f4f6;color:#374151;border:1px solid #d1d5db}
button.secondary:hover{background:#e5e7eb;transform:none;box-shadow:none}
button.danger{background:var(--c-danger)}
button.danger:hover{background:#b91c1c}
.muted{color:var(--c-muted);font-size:.85rem;text-wrap:pretty}
.stat{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-md);padding:20px;box-shadow:var(--shadow-sm);transition:transform .4s var(--ease-spring),box-shadow .4s var(--ease-spring)}
.stat:hover{transform:translateY(-3px);box-shadow:var(--shadow-md)}
.stat .v{font-size:1.8rem;font-weight:800;color:var(--c-primary);line-height:1}
.stat .l{font-size:.8rem;color:var(--c-muted);margin-top:6px;text-wrap:balance}
@media(max-width:640px){table{min-width:480px}.table-wrap{overflow-x:auto}}

/* ━━━ Scroll-driven Animations ━━━ */
@keyframes fade-in-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes fade-in-left{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
@keyframes scale-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
.scroll-fade{animation:fade-in-up linear both;animation-timeline:view();animation-range:entry 0% entry 35%}
.scroll-left{animation:fade-in-left linear both;animation-timeline:view();animation-range:entry 0% entry 35%}
.scroll-scale{animation:scale-in linear both;animation-timeline:view();animation-range:entry 0% entry 30%}
.card{animation:fade-in-up linear both;animation-timeline:view();animation-range:entry 0% entry 30%}
.stat{animation:scale-in linear both;animation-timeline:view();animation-range:entry 0% entry 25%}

/* ━━━ View Transitions ━━━ */
@view-transition{navigation:auto}
::view-transition-old(root){animation:.28s cubic-bezier(.4,0,1,1) both vt-slide-out}
::view-transition-new(root){animation:.3s cubic-bezier(0,0,.2,1) both vt-slide-in}
@keyframes vt-slide-out{to{opacity:0;transform:translateX(-18px) scale(.98)}}
@keyframes vt-slide-in{from{opacity:0;transform:translateX(18px) scale(.98)}}
::view-transition-group(hero){animation-duration:.5s}

/* ━━━ Anchor Positioning ━━━ */
.tooltip-wrap{position:relative;display:inline-block}
.tooltip-trigger{anchor-name:--tip}
.tooltip{
  position:absolute;
  position-anchor:--tip;
  top:anchor(bottom);left:anchor(center);
  translate:-50% 8px;
  background:#1e2433;color:#e2e8f0;font-size:.78rem;padding:6px 12px;
  border-radius:6px;white-space:nowrap;pointer-events:none;
  opacity:0;transform:translateY(-4px);
  transition:opacity .18s,transform .18s var(--ease-spring);
  box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:200;
}
.tooltip-wrap:has(.tooltip-trigger:hover) .tooltip,
.tooltip-wrap:has(.tooltip-trigger:focus) .tooltip{opacity:1;transform:translateY(0)}

/* ━━━ @starting-style — 플래시 없는 진입 애니메이션 ━━━ */
.card{transition:opacity .4s,transform .4s var(--ease-spring),box-shadow .3s}
@starting-style{
  .card{opacity:0;transform:translateY(14px)}
}
dialog{transition:opacity .3s,transform .3s var(--ease-spring),display .3s allow-discrete}
dialog[open]{opacity:1;transform:scale(1) translateY(0)}
@starting-style{
  dialog[open]{opacity:0;transform:scale(.94) translateY(-12px)}
}
.badge{transition:opacity .25s,transform .25s var(--ease-spring)}
@starting-style{
  .badge{opacity:0;transform:scale(.7)}
}
.stat{transition:opacity .4s,transform .4s var(--ease-spring),box-shadow .3s}
@starting-style{
  .stat{opacity:0;transform:scale(.9)}
}

/* ━━━ @scope — 컴포넌트 CSS 격리 ━━━ */
@scope (.card){
  :scope{position:relative}
  p{color:var(--c-text);line-height:1.6;margin:6px 0}
  a{color:var(--c-primary);font-weight:500}
  h3{font-size:1rem;font-weight:700;margin-bottom:10px;text-wrap:balance}
  code{background:oklch(from var(--c-primary) 0.95 0.03 h);color:var(--c-primary-d);padding:2px 6px;border-radius:4px;font-size:.85em}
}
@scope (.table-wrap){
  th{background:oklch(from var(--c-bg) calc(l - 0.03) c h)}
  td{color:var(--c-text)}
  tr:hover td{background:oklch(from var(--c-primary) 0.96 0.03 h)}
}
@scope (form){
  :scope{gap:14px}
  label{color:var(--c-text);font-weight:600}
  input,select,textarea{background:var(--c-surface);color:var(--c-text);border-color:var(--c-border)}
}
`.trim();
        const escapedBase = BASE_CSS.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedApp  = appCss ? appCss.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
        raw = raw.replace(
          /\(define GLOBAL-CSS[\s\S]*?"\)/,
          `(define GLOBAL-CSS "<style>${escapedBase}${escapedApp ? '\n' + escapedApp : ''}</style>")`
        );
      }
      // style 블록 제거 (헬퍼는 Critical CSS 인라인 불필요, app.css에 포함됨)
      const src = removeStyleBlocks(raw).trim();
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
    src = removeStyleBlocks(src).trim();
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
    const smStart = lines.length + 1; // 소스맵 시작 라인
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
    sourceMap[`${smStart}-${lines.length}`] = r.file; // 소스맵 기록
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

  return { content: lines.join('\n'), sourceMap };
}

const BUILD_START = Date.now();
const cache   = loadCache();
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

// app.css 내용 읽기 (layout에 인라인 주입용)
const cssFile = path.join(PUBLIC_DIR, 'app.css');
const appCssContent = fs.existsSync(cssFile)
  ? fs.readFileSync(cssFile, 'utf8').replace(/\n/g, ' ').trim()
  : '';

// Fix 4: (catch $e []) 패턴 감지
function detectDangerousPatterns(routes, helpers) {
  const issues = [];
  const allFiles = [...routes.map(r => r.file), ...helpers];
  for (const f of allFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const name = f.replace(PAGES_DIR + '/', '');
    // 빈 벡터 catch
    if (/\(catch\s+\$\w+\s+\[\]/.test(src))
      issues.push(`  ⚠ ${name}: (catch $e []) → (catch $e nil) 로 변경`);
    // 3자 이하 ALL_CAPS + 숫자없음 — API, URL, SQL 등이 가끔 파싱 에러
    // (DB, HMR, SPA 등은 실제 잘 동작하므로 경고 제외)
    if (/\(define\s+API\b|\(define\s+URL\b|\(define\s+SQL\b/.test(src))
      issues.push(`  ⚠ ${name}: API/URL/SQL 심볼 → api-base/url-base/sql-str 같이 소문자 사용 권장`);
  }
  if (issues.length) {
    console.log('\x1b[33m⚠ 위험 패턴 감지:\x1b[0m');
    issues.forEach(i => console.log(i));
  }
}

// Fix 5: check-parens.py 자동 실행 (파싱 오류 시 file:line:col 표시)
function checkAllParens(routes, helpers) {
  const CHECKER = '/home/kimjin/freelang-v11/scripts/check-parens.py';
  if (!fs.existsSync(CHECKER)) return;
  const allFiles = [...routes.map(r => r.file), ...helpers];
  const errors = [];
  for (const f of allFiles) {
    const fileName = path.basename(f);
    try {
      cp.execSync(`python3 ${CHECKER} ${f}`, { stdio: 'pipe' });
    } catch (e) {
      // check-parens.py 실제 출력: "❌ /path/file.flx:line:col — message"
      // 전체 경로 → 파일명만으로 교체
      const out = (e.stdout || Buffer.alloc(0)).toString().trim();
      const cleaned = out
        .replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fileName)
        .replace(/^❌ /gm, '');
      errors.push(`  \x1b[31m❌\x1b[0m ${cleaned}`);
    }
  }
  if (errors.length) {
    console.log('\x1b[31m❌ 파싱 오류 — 빌드 중단\x1b[0m');
    errors.forEach(e => console.log(e));
    process.exit(1);
  }
}

// h() {:class} — 정의된 CSS 바인딩에 없는 클래스명 경고
function validateHAttributes(routes, helpers, bindings) {
  if (!bindings || bindings.length === 0) return;
  const cssNames = new Set(bindings.map(b => b.name));
  const allFiles = [...routes.map(r => r.file), ...helpers];
  const issues = [];

  for (const f of allFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const name = path.basename(f);
    for (const m of src.matchAll(/\{:class\s+([\w-]+)/g)) {
      const cls = m[1];
      if (cssNames.has(cls)) continue;
      const before = src.slice(0, m.index);
      const line   = before.split('\n').length;
      const col    = m.index - before.lastIndexOf('\n');
      const similar = [...cssNames]
        .map(c => ({ c, d: levenshtein(cls, c) }))
        .filter(x => x.d <= 2)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .map(x => x.c);
      const hint = similar.length ? `  → \x1b[36m${similar.join(', ')}\x1b[0m` : '';
      issues.push(`  \x1b[33m⚠\x1b[0m {:class ${cls}}  \x1b[90m${name}:${line}:${col}\x1b[0m — CSS 미정의${hint}`);
    }
  }

  if (issues.length) {
    console.log('\n\x1b[33m⚠️  [경고] CSS 클래스 없음\x1b[0m');
    issues.forEach(i => console.log(i));
    console.log('');
  }
}

checkAllParens(routes, helpers);
detectDangerousPatterns(routes, helpers);

const { content: appContent, sourceMap } = generate(routes, bindings, helpers, appCssContent);
fs.writeFileSync(OUT_FILE, appContent, 'utf8');

// A. 빌드 시 미정의 함수 감지 (원본 .flx 파일 기준)
validateFunctions(routes, helpers, bindings);
validateHAttributes(routes, helpers, bindings);

// C. AGENTS.md 자동 생성
fs.writeFileSync(AGENTS_FILE, generateAgentsMd(routes, helpers), 'utf8');

// 빌드 캐시 저장 (다음 빌드에서 미변경 파일 감지용)
const newCache = {};
for (const r of routes) newCache[r.file] = fileHash(r.file);
for (const h of helpers) newCache[h] = fileHash(h);
newCache['fl-front-build.js'] = fileHash(path.join(__dirname, 'fl-front-build.js'));
newCache['style-compiler.js'] = fileHash(path.join(__dirname, 'style-compiler.js'));
newCache.sourceMap = sourceMap;
saveCache(newCache);

// 빌드 상태 저장 → dev-server.js /~ai 엔드포인트용
const buildState = {
  ok: true,
  time: new Date().toISOString(),
  routes: routes.map(r => ({ route: r.route, file: r.file, fn: r.fnName })),
  helpers: helpers.map(h => path.basename(h)),
  sourceMap,
  warnings: [],
};
try {
  fs.writeFileSync(
    path.join(__dirname, '.build-state.json'),
    JSON.stringify(buildState, null, 2),
    'utf8'
  );
} catch {}

const elapsed = Date.now() - BUILD_START;
console.log(`✅ _app.fl 생성 완료 (${routes.length}개 라우트, 헬퍼 ${helpers.length}개) [${elapsed}ms]`);
console.log(`✅ AGENTS.md 갱신 완료`);
