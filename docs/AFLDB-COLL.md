# afl-db 인덱스 컬렉션 패턴

> 다음 afl-db 앱은 Scratch/Notes CRUD를 복사하지 말 것.  
> 공통 모듈: `pages/_afldb_coll.flx` (HTTP는 `pages/_afldb.flx`)

## 키 계약 (불변)

```
fl:<ns>:index        → [id, id, ...]
fl:<ns>:item:<id>    → { "id", ..., "updated" }
```

예: `scratch` → `fl:scratch:index`, `fl:scratch:item:1784…`

## API

| 함수 | 역할 |
|------|------|
| `afldb-coll-create` | id·updated 부여 + put + index add |
| `afldb-coll-update` | patch merge + updated |
| `afldb-coll-delete` | index remove + tombstone delete |
| `afldb-coll-all` / `get` / `history` | 조회 |
| `afldb-coll-known` | 등록 ns의 index·item 키 (Events용) |

등록 ns: `afldb_coll_namespaces` (`scratch`, `notes`, `todo`, `bookmarks`, `clips`, …). 새 앱이면 **`_afldb_coll.flx` 맨 위 define에만 append** — 또는 `node fl-scaffold.js --ns <ns> --fields content`.

스캐폴드:
```bash
node fl-scaffold.js --ns clips --fields content --dry
node fl-scaffold.js --ns clips --fields content
```
금지 필드: `text`/`body`/`action`/`id` (req body 충돌).

## 페이지 스캐폴드 (콜드스타트)

```
pages/<name>/
  _db.flx      ; ns + afldb-coll-* thin wrapper
  api.flx      ; GET 목록 · POST action
  index.flx    ; UI (목록+추가+삭제)
```

라우트: `/<name>`, `/<name>/api` (빌드가 폴더명으로 자동 등록).  
충돌 시 TRAPS.md의 `*-afldb` 접미사. `node fl-manifest.js` → `routes`로 충돌 확인.

### API POST 관례 (권장)

```json
{"action":"add","title":"...","url":"..."}
{"action":"delete","id":"..."}
{"action":"history","id":"..."}
```

GET `/<name>/api` → `{ ok, items, status }` (`afldb-status` 포함 권장).  
Events의 collections는 `afldb-coll-known`이 등록 ns를 읽어 노출 — 별도 등록 불필요.

검증:
```bash
curl -sS http://127.0.0.1:40860/events/api   # known.collections 에 ns
curl -sS http://127.0.0.1:40860/<name>/api
```

## 최소 UI 레시피 (콜드스타트 — AGENTS 없이)

허용 문서만으로는 HTML 헬퍼가 안 보이므로 여기 최소 계약을 둔다:

```lisp
(defn render [req]
  (layout-html "제목"
    (h "div" {}
      (h "h1" {} "Bookmarks")
      (h "form" {:method "POST" :action "/bookmarks/api"}
        (h! "input" {:type "hidden" :name "action" :value "add"})
        (h! "input" {:type "text" :name "title" :placeholder "title"})
        (h! "input" {:type "text" :name "url" :placeholder "url"})
        (h! "button" {:type "submit"} "Add"))
      ; 목록은 SSR에서 (bookmarks-all) 맵핑
      )
    req))
```

- `layout-html` · `h` · `h!` · `arr-join` · `form-get` / `(get req "body")` · `server-json` · `server-redirect` 사용.
- 공통 CSS 모듈 없음 → 인라인 style 또는 무스타일. (공통 CSS는 보류)
- Island/`fetch!` 없이도 form POST면 CRUD 가능.

## 앱 _db 규칙

```lisp
(define my_ns "todo")   ; afldb_coll_namespaces 에도 추가

(defn todo-all [] (afldb-coll-all my_ns))
(defn todo-add [title]
  (afldb-coll-create my_ns {"title" title "done" false}))
```

도메인 필드·검증·핀 토글만 앱에 둔다. 인덱스/키 조립/삭제는 공통 모듈.

## 로드 순서

`_afldb.flx` → `_afldb_coll.flx` (파일명 underscore로 정렬 보장)
