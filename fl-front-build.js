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
  'form_field','form-field','url_decode','url-decode',
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
  // 서버 req 헬퍼
  'server-req-param','server-req-query','server-req-json',
  'server_req_param','server_req_query','server_req_json',
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

  // 1패스: 모든 .flx 파일에서 defn/define 수집
  const defined = new Set();
  for (const f of allFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\(defn\s+([\w-]+)/g))   defined.add(m[1]);
    for (const m of src.matchAll(/\(define\s+([\w-]+)/g)) defined.add(m[1]);
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
; HTML 빌더 (h() SSR)
(h "div" {:class btn :id "wrap"} "내용")    ; → <div class="btn__hash" id="wrap">내용</div>
(h "div" {:class card} (str child1 child2)) ; → 자식 결합
(h! "input" {:type "text" :name "q"})       ; → <input type="text" name="q">

; 배열 결합 (h() 자식 여러 개)
(arr-join (map render-fn items) "")         ; → 리스트 렌더링

; 폼 필드 읽기
(form-field req "name")       ; → "홍길동" 또는 ""
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
      // _layout.flx: GLOBAL-CSS에 app.css 내용 인라인 주입
      if (path.basename(helperPath) === '_layout.flx' && appCss) {
        const escapedCss = appCss.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        raw = raw.replace(
          /\(define GLOBAL-CSS[\s\S]*?"\)/,
          `(define GLOBAL-CSS "<style>${escapedCss}</style>")`
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

const appContent = generate(routes, bindings, helpers, appCssContent);
fs.writeFileSync(OUT_FILE, appContent, 'utf8');

// A. 빌드 시 미정의 함수 감지 (원본 .flx 파일 기준)
validateFunctions(routes, helpers, bindings);
validateHAttributes(routes, helpers, bindings);

// C. AGENTS.md 자동 생성
fs.writeFileSync(AGENTS_FILE, generateAgentsMd(routes), 'utf8');

// 빌드 캐시 저장 (다음 빌드에서 미변경 파일 감지용)
const newCache = {};
for (const r of routes) newCache[r.file] = fileHash(r.file);
for (const h of helpers) newCache[h] = fileHash(h);
newCache['fl-front-build.js'] = fileHash(path.join(__dirname, 'fl-front-build.js'));
newCache['style-compiler.js'] = fileHash(path.join(__dirname, 'style-compiler.js'));
saveCache(newCache);

const elapsed = Date.now() - BUILD_START;
console.log(`✅ _app.fl 생성 완료 (${routes.length}개 라우트, 헬퍼 ${helpers.length}개) [${elapsed}ms]`);
console.log(`✅ AGENTS.md 갱신 완료`);
