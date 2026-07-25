# FIX — afl-db batch write 경로 (2026-07-25)

## 증상
HTTP-INPROCESS 이후 콜당 비용은 ms대인데, clips create는 put+index get+index put로 **순차 3콜**.

## 원인
`afldb-coll-create`가 item·index를 각각 `afldb-put` — 같은 의미의 연속 put.

## 수정
- `pages/_afldb_coll.flx` create → `afldb-index-get` + `afldb-batch-put`([item, index])
- update/delete 미변경 (사유: read-then-write / batch-delete 없음)
- `scripts/perf-afldb.js` `composition_hint.http_calls` · `docs/AFLDB-COLL.md` 표

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# ok true · stdlibLoadOk true · warnings 26

pm2 restart freelang-front
curl -sS -X POST …/clips/api -d '{"action":"add","content":"…"}'
curl -sS -X POST …/clips/api -d '{"action":"delete","id":"…"}'
node scripts/perf-afldb.js --json
```

| 항목 | 전 | 후 |
|------|----|----|
| create HTTP | 3 | 2 |
| add+delete HTTP | 6 | 5 |
| `front_clips_crud_add_delete` median | 49 ms (before) | **47 ms** (after, 200-only 샘플; 429 오염 시 0.7ms로 가짜 하락 → perf 스크립트가 4xx reject) |

## PM2
`pm2 restart freelang-front` (완료).
