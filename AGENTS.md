# FL-Front AI Context (자동 생성 — 직접 수정 금지)

> 이 파일은 `fl-front-build.js` 빌드 시 자동 갱신됩니다.
> AI 세션 시작 시 반드시 읽으세요.

## 핵심 규칙

- 페이지 파일: `pages/*.flx` — `(defn render [req])` 필수
- POST 처리: `(defn render_post [req])` 추가하면 자동 등록
- 헬퍼 파일: `pages/_*.flx` — 라우트 미등록, 공통 함수용
- 빌드: `node fl-front-build.js` → `_app.fl` 생성

## 주입된 헬퍼 (모든 .flx에서 바로 사용 가능)

```lisp
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
```

## 절대 쓰지 말 것 (존재하지 않는 함수)

| ❌ 쓰면 안 됨 | ✅ 올바른 함수 |
|-------------|-------------|
| `url-decode` | → 주입된 `(url-decode s)` 사용 |
| `form-field req key` | → 주입된 `(form-field req key)` 사용 |
| `server-status` | → `server_status` (언더스코어) |
| `server-sse` | → ❌ 미지원 |
| `server-req-body` | → ❌ 미지원, `(get req "body")` 사용 |
| `str-split` | → `regex_split str pattern` |
| `str-includes?` | → `arr-includes?` (배열용만 있음) |

## 페이지 패턴

```lisp
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
```

## 현재 등록된 라우트

| 경로 | 파일 |
|------|------|
| `/about` | pages/about.flx |
| `/api/hello` | pages/api/hello.flx |
| `/contact/thanks` | pages/contact/thanks.flx |
| `/contact` | pages/contact.flx |
| `/counter` | pages/counter.flx |
| `/dashboard` | pages/dashboard.flx |
| `/` | pages/index.flx |
| `/login` | pages/login.flx |
| `/logout` | pages/logout.flx |
| `/notes` | pages/notes.flx |
| `/styled` | pages/styled.flx |
| `/todo` | pages/todo.flx |
| `/upload` | pages/upload.flx |
| `/users/:id` | pages/users/[id].flx |

## 네이밍 규칙

- FreeLang stdlib: `snake_case` (server_req_method, db_query)
- 주입 헬퍼: `kebab-case` (form-field, url-decode, dev-error-page)
- 페이지 핸들러: `render` / `render_post` (빌드 시 자동 rename)
