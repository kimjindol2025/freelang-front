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

## 함정 (다음 Cursor)

- `(do …)` — Island에서 side-effect 여러 개면 **필수**
- `let` 바인딩 끝 **`]`** — fn 정의 후 body 시작 전
- Island `map` 안 `{"k" v}` 맵 리터럴 → JS 컴파일 실패 → fn 인자로 lookup
- `check-parens.py` false positive → **`fl-front-build.js`만** 신뢰
- Island re-render 후 CDP/DOM — **row 재query** (stale node 금지)

## 참고 파일

- 패턴 주석: `pages/_island-patterns.flx`
- 예제: `pages/examples/31-island-patterns.flx`
- 실제 앱: `people/`, `market/`, `followups/`, `flow/`
