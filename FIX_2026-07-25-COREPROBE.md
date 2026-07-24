# FIX — freelang-front COREPROBE-001 (2026-07-25)

## 증상
PERF 이후에도 FL→afl-db 콜당 수백 ms 바닥. CRUD ~4s.

## 원인
(코드+측정) `http_get` 경로 `nodeHttpRequest`가 **매 요청 `spawnSync("node",["-e",…])`**.

## 수정
코어 수정 없음. 산출물:
- `docs/CORE-TICKET-HTTP-SPAWN.md`
- `scripts/probe-fl-http.js`
- TRAPS verify 트레이드오프 한 줄

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js --json
# direct_stats ~1ms · spawnsync_stats ~140ms · front_api_afldb ≈ spawnsync
```

## PM2
해당 없음 (문서·스크립트만).
