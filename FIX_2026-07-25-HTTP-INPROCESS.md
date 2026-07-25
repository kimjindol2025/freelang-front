# FIX — freelang-front HTTP-INPROCESS (2026-07-25)

## 증상
afl-db 경유 API(` /api/afldb`, clips CRUD)가 백엔드 1ms대인데도 front에서 콜당 ~100–150ms+, CRUD ~4s.

## 원인
`runtime/bootstrap.js` `nodeHttpRequest`가 요청마다 `spawnSync("node", ["-e", …])`.

## 수정
- `freelang-v11` in-process HTTP(worker_threads)를 **함수 단위**로 front bootstrap에 이식
- `flSsrfBlockReason` / `FL_HTTP_ALLOW` 보존 (전체 bootstrap 덮어쓰기 금지)
- 티켓 상태 갱신: `docs/CORE-TICKET-HTTP-SPAWN.md`

## 검증
```bash
pm2 restart freelang-front
FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js --json
# front_api_afldb median ~5.8ms (이전 ~152ms)

# CRUD
curl -sS -X POST http://127.0.0.1:40860/clips/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","title":"t","content":"x"}'
# add+delete 왕복 ~57ms
```

## PM2
`pm2 restart freelang-front` (완료). `:40860` / afl-db `:40610` online 유지.
