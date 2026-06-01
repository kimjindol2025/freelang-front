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
```

## 절대 쓰지 말 것 (존재하지 않는 함수 + 자주 틀리는 것)

| ❌ 쓰면 안 됨 | ✅ 올바른 함수 |
|-------------|-------------|
| `server-req-body` | `(get req "body")` |
| `server-html` | `server_html` (언더스코어) |
| `str-split` | `regex_split str pattern` |
| `str-includes?` | `(> (str-count s sub) 0)` |
| `nil?` | `(= x nil)` |
| `map-indexed` | `(map fn arr)` + index 수동 |
| `string?` | ❌ 없음 |
| `server-sse` | ❌ 미지원 |
| `(catch $e [])` | `(catch $e nil)` → 빈 벡터 반환은 에러 |

## FreeLang 변수명 규칙 (반드시 준수)

- **소문자만** — `api-base` ✅, `API` ❌ (대문자 심볼 파싱 에러)
- **하이픈 허용** — `my-var`, `api-base` 모두 가능
- **underscore도 허용** — `my_var`, `api_base`
- **stdlib**: snake_case (`server_html`, `db_query`)
- **주입 헬퍼**: kebab-case (`form-field`, `arr-join`, `dispatch-html`)

## h() 괄호 디버깅 팁

중첩 h()를 쓸 때 괄호 불균형이 자주 발생합니다:
```bash
# 빌드 전 반드시 검증
python3 /home/kimjin/freelang-v11/scripts/check-parens.py pages/mypage.flx
```

복잡한 중첩은 defn으로 분리:
```lisp
; ❌ 한 번에 쓰면 괄호 추적 어려움
(h "div" {} (h "ul" {} (arr-join (map (fn [i] (h "li" {} ...)) items) "")))

; ✅ 헬퍼 함수로 분리
(defn render-item [i] (h "li" {} (get i "name")))
(h "div" {} (h "ul" {} (arr-join (map render-item items) "")))
```

## 페이지 패턴

```lisp
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
| `/demo` | pages/demo.flx |
| `/fetch-demo` | pages/fetch-demo.flx |
| `/freelang` | pages/freelang.flx |
| `/intro` | pages/intro.flx |
| `/login` | pages/login.flx |
| `/logout` | pages/logout.flx |
| `/notes` | pages/notes.flx |
| `/styled` | pages/styled.flx |
| `/test-helpers` | pages/test-helpers.flx |
| `/todo` | pages/todo.flx |
| `/upload` | pages/upload.flx |
| `/users/:id` | pages/users/[id].flx |

## 네이밍 규칙

- FreeLang stdlib: `snake_case` (server_req_method, db_query)
- 주입 헬퍼: `kebab-case` (form-field, url-decode, dev-error-page)
- 페이지 핸들러: `render` / `render_post` (빌드 시 자동 rename)

## @type 주석 컨벤션 (AI 타입 힌트)

파일 상단에 아래 형식으로 작성하면 AGENTS.md에 자동 포함됩니다:
```lisp
; @type user: {id: int, name: string, email: string}
; @type req.params.id: string
; @type items: [{id: int, title: string, done: bool}]
```

## AI 디버그 API

```bash
# 현재 앱 상태 (라우트, 에러, 소스맵) 한 번에 조회
curl http://localhost:40851/~ai | python3 -m json.tool

# 브라우저 에러만
curl http://localhost:40851/~errors
```
