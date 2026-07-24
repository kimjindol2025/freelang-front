# FIX — afl-db 컬렉션 공통 모듈 (2026-07-25)

## 증상
Scratch·Notes가 index/load/delete를 각각 복제 → 다음 앱부터 패턴 분기 위험.

## 수정
- `pages/_afldb_coll.flx` — `fl:<ns>:index` / `fl:<ns>:item:<id>` CRUD
- scratch·notes `_db`는 도메인 thin wrapper
- events는 `afldb-coll-known` (앱 _db load 제거)
- `docs/AFLDB-COLL.md`

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js
curl -sS http://127.0.0.1:40860/scratch/api
curl -sS http://127.0.0.1:40860/notes-afldb/api
curl -sS http://127.0.0.1:40860/events/api
```
