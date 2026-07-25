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
| `/api/afldb` | pages/api/afldb.flx |
| `/api/alerts/stream` | pages/api/alerts/stream.flx |
| `/api/alerts` | pages/api/alerts.flx |
| `/api/custom-metrics` | pages/api/custom-metrics.flx |
| `/api/errors-stats` | pages/api/errors-stats.flx |
| `/api/errors` | pages/api/errors.flx |
| `/api/hello` | pages/api/hello.flx |
| `/api/logs/recent` | pages/api/logs/recent.flx |
| `/api/metrics/export` | pages/api/metrics/export.flx |
| `/api/metrics/filter` | pages/api/metrics/filter.flx |
| `/api/metrics/stream` | pages/api/metrics/stream.flx |
| `/api/metrics` | pages/api/metrics.flx |
| `/api/notes` | pages/api/notes.flx |
| `/api/playground/eval` | pages/api/playground/eval.flx |
| `/api/sla/report` | pages/api/sla/report.flx |
| `/api/sla/status` | pages/api/sla/status.flx |
| `/api/sla` | pages/api/sla.flx |
| `/app/api-init` | pages/app/api-init.flx |
| `/app/api` | pages/app/api.flx |
| `/app` | pages/app/index.flx |
| `/bookmarks/api` | pages/bookmarks/api.flx |
| `/bookmarks` | pages/bookmarks/index.flx |
| `/check` | pages/check.flx |
| `/clips/api` | pages/clips/api.flx |
| `/clips` | pages/clips/index.flx |
| `/contact/thanks` | pages/contact/thanks.flx |
| `/contact` | pages/contact.flx |
| `/contacts/api` | pages/contacts/api.flx |
| `/contacts` | pages/contacts/index.flx |
| `/contacts/remind` | pages/contacts/remind.flx |
| `/counter` | pages/counter.flx |
| `/dashboard/alerts` | pages/dashboard/alerts.flx |
| `/dashboard/charts` | pages/dashboard/charts.flx |
| `/dashboard/custom-metrics` | pages/dashboard/custom-metrics.flx |
| `/dashboard` | pages/dashboard/index.flx |
| `/dashboard/operations` | pages/dashboard/operations.flx |
| `/dashboard/sla` | pages/dashboard/sla.flx |
| `/decisions/api` | pages/decisions/api.flx |
| `/decisions` | pages/decisions/index.flx |
| `/demo` | pages/demo.flx |
| `/events/api` | pages/events/api.flx |
| `/events` | pages/events/index.flx |
| `/examples/01-hello` | pages/examples/01-hello.flx |
| `/examples/02-card-grid` | pages/examples/02-card-grid.flx |
| `/examples/03-list-filter` | pages/examples/03-list-filter.flx |
| `/examples/04-form` | pages/examples/04-form.flx |
| `/examples/05-form-validate` | pages/examples/05-form-validate.flx |
| `/examples/06-counter` | pages/examples/06-counter.flx |
| `/examples/07-toggle` | pages/examples/07-toggle.flx |
| `/examples/08-tabs` | pages/examples/08-tabs.flx |
| `/examples/09-accordion` | pages/examples/09-accordion.flx |
| `/examples/10-todo` | pages/examples/10-todo.flx |
| `/examples/11-live-search` | pages/examples/11-live-search.flx |
| `/examples/12-star-rating` | pages/examples/12-star-rating.flx |
| `/examples/13-char-count` | pages/examples/13-char-count.flx |
| `/examples/14-toast` | pages/examples/14-toast.flx |
| `/examples/15-modal` | pages/examples/15-modal.flx |
| `/examples/16-dropdown` | pages/examples/16-dropdown.flx |
| `/examples/17-wizard` | pages/examples/17-wizard.flx |
| `/examples/18-slider` | pages/examples/18-slider.flx |
| `/examples/19-color-picker` | pages/examples/19-color-picker.flx |
| `/examples/20-password-strength` | pages/examples/20-password-strength.flx |
| `/examples/21-cart` | pages/examples/21-cart.flx |
| `/examples/22-temp-convert` | pages/examples/22-temp-convert.flx |
| `/examples/23-like-store` | pages/examples/23-like-store.flx |
| `/examples/24-pagination` | pages/examples/24-pagination.flx |
| `/examples/25-i18n` | pages/examples/25-i18n.flx |
| `/examples/26-json-api` | pages/examples/26-json-api.flx |
| `/examples/27-fetch` | pages/examples/27-fetch.flx |
| `/examples/28-poll` | pages/examples/28-poll.flx |
| `/examples/29-bmi` | pages/examples/29-bmi.flx |
| `/examples/30-lightbox` | pages/examples/30-lightbox.flx |
| `/examples` | pages/examples/index.flx |
| `/feed/api` | pages/feed/api.flx |
| `/feed` | pages/feed/index.flx |
| `/fetch-demo` | pages/fetch-demo.flx |
| `/files/api` | pages/files/api.flx |
| `/files` | pages/files/index.flx |
| `/flash/api` | pages/flash/api.flx |
| `/flash` | pages/flash/index.flx |
| `/flash/study` | pages/flash/study.flx |
| `/freelang` | pages/freelang.flx |
| `/goals/api` | pages/goals/api.flx |
| `/goals` | pages/goals/index.flx |
| `/health/api` | pages/health/api.flx |
| `/health` | pages/health/index.flx |
| `/health/log` | pages/health/log.flx |
| `/` | pages/index.flx |
| `/intro` | pages/intro.flx |
| `/login` | pages/login.flx |
| `/logout` | pages/logout.flx |
| `/logs` | pages/logs.flx |
| `/notes-afldb/api` | pages/notes-afldb/api.flx |
| `/notes-afldb` | pages/notes-afldb/index.flx |
| `/notes-island` | pages/notes-island.flx |
| `/notes` | pages/notes.flx |
| `/photos/api` | pages/photos/api.flx |
| `/photos` | pages/photos/index.flx |
| `/playground` | pages/playground.flx |
| `/prompts/api` | pages/prompts/api.flx |
| `/prompts` | pages/prompts/index.flx |
| `/reading/api` | pages/reading/api.flx |
| `/reading` | pages/reading/index.flx |
| `/scratch/api` | pages/scratch/api.flx |
| `/scratch` | pages/scratch/index.flx |
| `/shop/cart` | pages/shop/cart.flx |
| `/shop` | pages/shop/index.flx |
| `/shop/orders` | pages/shop/orders.flx |
| `/styled` | pages/styled.flx |
| `/subs/api` | pages/subs/api.flx |
| `/subs` | pages/subs/index.flx |
| `/tasks` | pages/tasks.flx |
| `/test-helpers` | pages/test-helpers.flx |
| `/todo-afldb/api` | pages/todo-afldb/api.flx |
| `/todo-afldb` | pages/todo-afldb/index.flx |
| `/todo` | pages/todo.flx |
| `/upload` | pages/upload.flx |
| `/vault/api` | pages/vault/api.flx |
| `/vault` | pages/vault/index.flx |
| `/api/notes/:id/delete` | pages/api/notes/[id]/delete.flx |
| `/api/notes/:id/pin` | pages/api/notes/[id]/pin.flx |
| `/contacts/:id` | pages/contacts/[id].flx |
| `/flash/:id` | pages/flash/[id].flx |
| `/goals/:id` | pages/goals/[id].flx |
| `/reading/:id` | pages/reading/[id].flx |
| `/shop/orders/:id` | pages/shop/orders/[id].flx |
| `/shop/products/:id` | pages/shop/products/[id].flx |
| `/shop/users/:id` | pages/shop/users/[id].flx |
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

## 헬퍼 파일 함수 목록 (자동 추출)

### `_layout.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `nav-link` | `[href label current]` | nav 링크 — 현재 경로 강조 + SPA 라우팅 |
| `seo-tags` | `[m]` | 사용: (seo-tags {:title "제목" :desc "설명" :image "/og.png" :type "article"}) |
| `layout-core` | `[title content req meta-str]` | 공통 레이아웃 → HTML 문자열 (meta-str: seo-tags 결과 또는 nil) |
| `layout` | `[title content req]` | layout — 기존 호환 유지 |
| `layout-html` | `[title content req]` | layout-html — server-html + DEV CSP |
| `layout-html-seo` | `[title content req seo-opts]` | 사용: (layout-html-seo "제목" content req {:title "..." :desc "..." :image "/og.png"}) |

### `_db.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `db-migrate` | `[]` | 마이그레이션 — 서버 시작 시 자동 실행 |
| `db-fetch-stats` | `[]` | DB에서 대시보드 통계 조회 |

### `_afldb.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `afldb-kv-url` | `[key]` |  |
| `afldb-resp-field` | `[resp k-str k-kw]` |  |
| `afldb-field` | `[obj k-str k-kw]` |  |
| `afldb-response-body` | `[resp]` |  |
| `afldb-http-error` | `[resp]` |  |
| `afldb-unwrap-value` | `[key parsed]` |  |
| `afldb-get` | `[key fallback]` |  |
| `afldb-put` | `[key value]` |  |
| `afldb-batch-get` | `[keys]` |  |
| `afldb-batch-put` | `[items]` |  |
| `afldb-history` | `[key]` |  |
| `afldb-verify` | `[]` |  |
| `afldb-stats` | `[]` |  |
| `afldb-delete` | `[key]` |  |
| `afldb-index-get` | `[index-key]` |  |
| `afldb-index-add-id` | `[index-key id]` |  |
| `afldb-index-remove-id` | `[index-key id]` |  |
| `afldb-load-values` | `[keys]` |  |
| `afldb-status` | `[]` | 무결성 검사는 (afldb-verify) / /check 에서만. |

### `_afldb_coll.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `afldb-coll-index-key` | `[ns]` |  |
| `afldb-coll-item-key` | `[ns id]` |  |
| `afldb-coll-ids` | `[ns]` |  |
| `afldb-coll-item-keys` | `[ns]` |  |
| `afldb-coll-all` | `[ns]` |  |
| `afldb-coll-get` | `[ns id]` |  |
| `afldb-coll-create` | `[ns item]` | HTTP: 이전 put+get+put = 3 → get+batch-put = 2 |
| `afldb-coll-update` | `[ns id patch]` |  |
| `afldb-coll-delete` | `[ns id]` |  |
| `afldb-coll-history` | `[ns id]` |  |
| `afldb-coll-known` | `[]` | Events / 점검용 — 등록된 ns 목록의 index·item 키 |

### `_auth.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `auth-session-id` | `[req]` | 쿠키에서 세션 ID 읽기 |
| `auth-check` | `[req]` | 세션 유효성 검사 → username 또는 nil |
| `auth-login` | `[username password]` | 로그인 → 세션 생성 + 쿠키 문자열 반환 (실패 시 nil) |
| `auth-logout` | `[req]` | 로그아웃 → 세션 삭제 + 만료 쿠키 문자열 반환 |
| `auth-required` | `[req handler]` | 인증 필요 라우트 가드 — 미인증 시 /login redirect |

### `_error.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `page-404` | `[req]` |  |
| `page-500` | `[msg req]` |  |
| `not-found-handler` | `[req]` | 와일드카드 핸들러 — 등록되지 않은 모든 경로 |

### `_charts.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `chart-bar` | `[data w h]` | 막대 차트 |
| `chart-line` | `[data w h]` | 선 차트 |

### `_email.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `sg-send` | `[$to $subject $text $html]` |  |
| `sg-template` | `[$to $template-id $data]` | SendGrid 템플릿 발송 |
| `mg-send` | `[$to $subject $text $html]` |  |
| `email-send` | `[$to $subject $text]` | 일반 텍스트 이메일 |
| `email-html` | `[$to $subject $html]` | HTML 이메일 |
| `email-template` | `[$to $template-id $data]` | SendGrid 템플릿 |
| `email-welcome` | `[$to $name]` | 회원가입 환영 메일 |
| `email-reset-password` | `[$to $reset-link]` | 비밀번호 재설정 메일 |
| `email-payment-done` | `[$to $name $amount $order-id]` | 결제 완료 메일 |
| `email-otp` | `[$to $code]` | 인증 코드 메일 |

### `_oauth.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `oauth-google-url` | `[$redirect-path]` | Google 로그인 URL 생성 |
| `oauth-google-callback` | `[$code $redirect-path]` | Google 콜백 처리 → 사용자 정보 반환 |
| `oauth-kakao-url` | `[$redirect-path]` |  |
| `oauth-kakao-callback` | `[$code $redirect-path]` |  |
| `oauth-github-url` | `[$redirect-path]` |  |
| `oauth-github-callback` | `[$code $redirect-path]` |  |
| `oauth-naver-url` | `[$redirect-path $state]` |  |
| `oauth-naver-callback` | `[$code $state $redirect-path]` |  |
| `oauth-upsert-user` | `[$provider-user]` | user = {"ok" true "email" "..." "name" "..." "provider" "google"} |

### `_payment.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `toss-auth` | `[]` | Toss Basic Auth 헤더 생성 |
| `payment-confirm` | `[$payment-key $amount $order-id]` | orderId: 주문 번호 |
| `payment-get` | `[$payment-key]` | 결제 조회 |
| `payment-cancel` | `[$payment-key $reason]` | 결제 취소 (전액) |
| `payment-partial-cancel` | `[$payment-key $amount $reason]` | 결제 부분 취소 |
| `payment-virtual-account` | `[$amount $order-id $customer-name]` | 가상계좌 발급 |
| `payment-safe-confirm` | `[$payment-key $db-amount $req-amount $order-id]` | DB에서 실제 금액 확인 후 결제 승인해야 함 |
| `portone-token` | `[]` | 포트원 액세스 토큰 발급 |
| `portone-verify` | `[$imp-uid $expected-amount]` | 포트원 결제 검증 |

### `_storage.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `s3-public-url` | `[$key]` | 오브젝트 공개 URL (CDN 있으면 CDN, 없으면 S3 직접) |
| `s3-sign` | `[$string-to-sign $date $region]` | S3 서명 문자열 생성 (HMAC-SHA256 기반) |
| `storage-put` | `[$key $local-path $content-type]` | 로컬 파일을 S3에 업로드 |
| `storage-put-base64` | `[$key $base64-data $content-type]` | Base64 데이터를 S3에 업로드 (클라이언트 전송 데이터) |
| `storage-url` | `[$key]` | 공개 URL (Public 버킷) |
| `storage-presign` | `[$key $expires]` | expires: 초 단위 (기본 3600 = 1시간) |
| `storage-presign-upload` | `[$key $content-type $expires]` | 클라이언트 직접 업로드용 presigned PUT URL |
| `storage-delete` | `[$key]` | 파일 삭제 |
| `storage-key` | `[$folder $filename]` | (storage-key "avatars" "photo.jpg") → "avatars/2026/06/uuid.jpg" |
| `storage-avatar-key` | `[$user-id]` | 이미지 업로드용 키 (user-id 기반) |
| `storage-attachment-key` | `[$order-id $filename]` | 첨부파일 키 (order-id + 파일명) |

### `_styles.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `s` | `[& parts]` | ── style 조합 함수 ────────────────────────────────────────── |
| `row` | `[gap]` | ── 레이아웃 ───────────────────────────────────────────────── |
| `col` | `[gap]` |  |
| `between` | `[]` |  |
| `center` | `[]` |  |
| `full` | `[]` |  |
| `flex1` | `[]` |  |
| `p` | `[v]` | ── 간격 ───────────────────────────────────────────────────── |
| `px` | `[v]` |  |
| `py` | `[v]` |  |
| `mg` | `[v]` |  |
| `w` | `[v]` | ── 크기 ───────────────────────────────────────────────────── |
| `ht` | `[v]` |  |
| `wh` | `[v]` |  |
| `mxw` | `[v]` |  |
| `rounded` | `[r]` | ── 테두리 ─────────────────────────────────────────────────── |
| `border` | `[]` |  |
| `border-b` | `[]` |  |
| `border-r` | `[]` |  |
| `bg` | `[c]` | ── 배경/색상 ──────────────────────────────────────────────── |
| `fg` | `[c]` |  |
| `bg-panel` | `[]` |  |
| `bg-page` | `[]` |  |
| `fs` | `[v]` | ── 텍스트 ─────────────────────────────────────────────────── |
| `fw` | `[v]` |  |
| `truncate` | `[]` |  |
| `upper` | `[]` |  |
| `mono` | `[]` |  |
| `pointer` | `[]` | ── 커서/상호작용 ──────────────────────────────────────────── |
| `none` | `[]` |  |
| `abs` | `[]` |  |
| `fixed` | `[]` |  |
| `rel` | `[]` |  |
| `inset` | `[]` |  |
| `ovh` | `[]` |  |
| `ova` | `[]` |  |

### `_ui.flx`

| 함수 | 파라미터 | 설명 |
|------|----------|------|
| `ui-btn` | `[type label]` |  |
| `ui-badge` | `[text color]` |  |
| `ui-avatar` | `[name size]` |  |
| `ui-divider` | `[]` |  |
| `ui-spinner` | `[]` |  |
| `ui-input` | `[name label type placeholder]` |  |
| `ui-textarea` | `[name label rows]` |  |
| `ui-select` | `[name label options]` | ===== Select ===== |
| `ui-checkbox` | `[name label checked]` |  |
| `ui-form-group` | `[& fields]` |  |
| `ui-card` | `[title content]` |  |
| `ui-grid` | `[cols content]` | ===== Grid ===== |
| `ui-stack` | `[content]` | ===== Stack ===== |
| `ui-row` | `[content]` | ===== Row ===== |
| `ui-alert` | `[type message]` |  |
| `ui-empty` | `[icon message]` |  |
| `ui-progress` | `[value max]` |  |
| `ui-table` | `[headers rows]` |  |
| `ui-stat` | `[label value diff]` |  |
| `ui-tags` | `[& tags]` |  |

## FreeLang v11 stdlib 함수 탐색

```bash
# 전체 함수 목록 (482개)
node /home/kim/바탕화면/kim/freelang-v11/bootstrap.js ls-fns

# 키워드 필터
node /home/kim/바탕화면/kim/freelang-v11/bootstrap.js ls-fns str
node /home/kim/바탕화면/kim/freelang-v11/bootstrap.js ls-fns db
node /home/kim/바탕화면/kim/freelang-v11/bootstrap.js ls-fns http
```

## AI 디버그 API

```bash
# 현재 앱 상태 (라우트, 에러, 소스맵) 한 번에 조회
curl http://localhost:40851/~ai | python3 -m json.tool

# 브라우저 에러만
curl http://localhost:40851/~errors
```
