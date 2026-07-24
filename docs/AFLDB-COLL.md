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

등록 ns: `afldb_coll_namespaces` (`scratch`, `notes`, `todo`). 새 앱이면 **`_afldb_coll.flx` 맨 위 define에만 append**.

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
