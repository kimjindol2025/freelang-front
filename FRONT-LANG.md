# FreeLang Front 언어

> **한 가지 프론트 언어 = FreeLang SSR + API + Island**  
> Island는 “옵션 JS 프레임워크”가 아니라 **제품 앱 UI의 3층**이다.

## 3층 구조

| 층 | 파일 | 역할 | 예 |
|----|------|------|-----|
| **1. SSR** | `index.flx` `(defn render …)` | HTML 골격, SEO, layout | `h`, `layout-html` |
| **2. API** | `api.flx` | JSON CRUD, DB | `server-json`, `db-query` |
| **3. Island** | `(island App [] …)` | 필터·펼침·즉시추가·fetch | `atom`, `fetch!` |

**정적 페이지** → 1층만  
**폼 + redirect** → 1층 + `render_post`  
**제품 앱 (People/Market/Flow)** → **1 + 2 + 3**

## Island 4대 패턴 (Front 언어 표준)

C2C 앱에서 반복되는 UI는 아래 네 가지로 통일한다.

### P1 · 필터 (filter)

```lisp
filter-k (atom "all")
items    (fn [] (or (get @data "items") []))
visible  (fn []
           (filter (fn [r]
                     (if (= @filter-k "all") true
                       (= (get r "status") @filter-k)))
             (items)))

; chip
(h "button" {:on-click (fn [] (reset! filter-k "active"))} "활성")
(arr-join (map row-view (visible)) "")
```

**실증**: People `filter-k`, Followups due chip

### P2 · 펼침 (expand)

```lisp
expand-id (atom nil)
toggle    (fn [id]
            (reset! expand-id (if (= @expand-id id) nil id)))

; row
(h "div" {:on-click (fn [] (toggle (get row "id")))} …)
(if (= @expand-id (get row "id"))
  (h "div" {:class "panel"} …액션폼…)
  "")
```

**실증**: People/Market 행 펼침 → Market 올리기, 후속 만들기

### P3 · 즉시 추가 (instant add)

```lisp
loaded  (atom false)
err     (atom "")
show-form (atom false)

reload (fn [res]
         (if (= (get res "ok") false)
           (reset! err (or (get res "error") "실패"))
           (do (reset! data res) (reset! err "") (reset! show-form false))))

add-item (fn []
           (fetch-post! "/my/api" {"action" "add" "title" @title-in} reload))

(when (not @loaded)
  (do (reset! loaded true) (fetch! "/my/api" reload)))
```

**실증**: People `+ 추가`, Market 글쓰기

### P4 · 다중 fetch (multi-fetch)

```lisp
a (atom nil)  b (atom nil)  c (atom nil)
loaded (atom false)

reload-all (fn []
             (do
               (fetch! "/people/api"    (fn [r] (reset! a r)))
               (fetch! "/market/api"    (fn [r] (reset! b r)))
               (fetch! "/followups/api" (fn [r] (reset! c r)))))

(when (not @loaded)
  (do (reset! loaded true) (reload-all)))
```

**실증**: Flow `/flow` — 클라이언트 join (`source_type` / `source_id`)

## 표준 앱 폴더

```
pages/myapp/
  _db.flx      ← SQLite init
  api.flx      ← action=add|delete|… JSON
  index.flx    ← render + island
```

## Island 필수 atom (체크리스트)

| atom | 용도 |
|------|------|
| `loaded` | mount 시 fetch 1회 |
| `data` | API 응답 |
| `err` | 패널/토스트 에러 |
| `filter-k` | P1 |
| `expand-id` | P2 |
| `show-form` | P3 입력 폼 |

---

## 오류·버그·함정 (언어 명세 — **필독**)

> C2C MVP(Followups→Flow)에서 실제로 터진 것만. **새 페이지 작성 전 이 섹션부터.**

### A. 빌드·괄호

| 증상 | 원인 | 올바른 것 |
|------|------|-----------|
| `미닫힘 '(' (line 3 island)` | `let [` 바인딩 끝 **`]`** 누락 | fn 정의 뒤 `]` → body `(when …)` |
| island body 끝 괄호 1개 부족 | `(if err …)` 뒤 `)` 개수 | Flow: **7개** (str→h→if→let→island) |
| `pm-row`/`make-market` build fail | fn 닫는 `)` 1개 부족 | pid/lid 뒤 **`)` 7개** (6개면 실패) |
| `check-parens.py` 3개 미닫힘 | Island + `"""` CSS false positive | **판정은 `node fl-front-build.js`만** |
| 중첩 `h()` 괄호 지옥 | 한 블록에 HTML 전부 | `defn row-view` 등 **fn 분리** |

```bash
# 유일한 빌드 판정
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js
# → errors=0, Island 11/11 PASS
```

### B. Island 컴파일·런타임

| 증상 | 원인 | 올바른 것 |
|------|------|-----------|
| `missing ) after argument list` (브라우저) | `map` 안 `{"fu" fu "m" m}` 맵 리터럴 | fn이 `fu` 받아 **직접 lookup** |
| `ReferenceError: h_bang` | `(h! …)` Island 컴파일 (구버전) | `(h "input" …)` — `h!`는 SSR만 |
| Island `(cond … (h …))` runtime null | build가 못 잡음 | **`(if … (h …) "")`** |
| fetch 무한 루프 | `loaded` atom 없음 | `(when (not @loaded) (do (reset! loaded true) (fetch! …)))` |
| side-effect 2개+ 무반응 | `(do …)` 누락 | `(do (reset! a) (fetch! …))` |
| `:on-input` 값 안 들어옴 | `(get e "target")` | **`(.-value (.-target e))`** |
| `[map1 map2 …]` 오파싱 | 벡터 → 함수 호출로 파싱 | island-compiler 수정됨 — 그래도 **map 리터럴 주의** |
| `(length x)` 이상 | compiler emit 괄호 | empty 비교는 `(= (length x) 0)` 명시 |
| re-render 후 click 무반응 | **stale DOM** | chip/expand 후 **row 재query** |
| `(catch $e [])` | 빈 벡터 catch | **`(catch $e nil)`** |

### C. API·DB·payload

| 증상 | 원인 | 올바른 것 |
|------|------|-----------|
| POST 500 / 응답 이상 | `(defn payload [])` 전역 충돌 | **`myapp-payload`** 고유명 |
| SQLite row 필드 nil | `(obj-merge row …)` | **`(get row "key")` 명시** |
| `today` / stat 틀림 | merge로 키 덮임 | SQL 결과 **키별 복사** |
| POST body 못 읽음 | `server-req-body` | **`(get req "body")`** |
| API 검증 헷갈림 | curl 여러 URL 한 줄 | **URL별 curl 따로** |
| `.db` 커밋 | 런타임 DB | **git 제외** (`data/*.db`) |

### D. FreeLang 문법 (절대 금지)

| ❌ 금지 | ✅ 올바른 것 |
|--------|-------------|
| `(def x 1)` Clojure | `(define x 1)` |
| `(map arr fn)` | **`(map fn arr)`** |
| `(filter arr fn)` | **`(filter fn arr)`** |
| `(merge a b)` | `(obj-merge a b)` |
| `(if-let [x expr] …)` | `(if-let [[x expr]] …)` |
| `json_parse` (하이픈 없음) | `json-parse` |
| `server-html` in stdlib | `server_html` |
| `str-split` | `regex_split` |
| `nil?` | `(= x nil)` |
| `map-indexed` | `(map fn arr)` + index 수동 |
| `string?` | ❌ 없음 |
| `server-sse` | ❌ 미지원 |
| 대문자 심볼 `API` | **소문자만** `api-base` |

### E. style DSL (`(style …)`)

| ❌ 쓴 것 | ✅ 올바른 키 |
|---------|-------------|
| `:direction "column"` | **`:flex-dir "column"`** |
| `:w` / `:h` | **`:width` / `:height`** |
| `:border-left` | inline style 또는 GLOBAL-CSS |
| `(s nav-link-base nav-link-active)` class 합치기 | **`str`로 class명** 또는 inline style |

### F. 운영·HMR·검증

| 현상 | 설명 |
|------|------|
| `:40851 ERR_CONNECTION_REFUSED` | PM2(`npm start`)에는 HMR 없음 — **정상**, `[hmr] off` info |
| HMR 필요 | `npm run dev` (40860+40851), PM2와 **동시 X** |
| Island 날짜 연산 | Island에 stdlib 날짜 없음 → API `today` + `<script>date_add_days</script>` |
| Error Overlay 429/HMR | `/~hmr` 노이즈 — API·오버레이 **스킵** |
| CDP/브라우저 검증 | Island re-render 후 **DOM ref 재획득** 필수 |

### G. 런타임만 터지는 것 (build 0이어도)

- Island `(cond …)` → DOM branch
- `fetch!` callback 안 `(get res "ok")` 미가드
- SPA 전환 후 Island script re-eval — `loaded` 리셋 주의

---

## 참고 파일

- 패턴 주석: `pages/_island-patterns.flx`
- 예제: `pages/examples/31-island-patterns.flx`
- 실제 앱: `people/`, `market/`, `followups/`, `flow/`
