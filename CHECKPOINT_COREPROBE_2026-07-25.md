# CHECKPOINT — COREPROBE-001 (2026-07-25)

## 목적지
미래 코어 작업자가 티켓 1장으로 바로 착수 가능한 상태.

## 결과
- 책임 분리: direct `/stats` 0.8ms vs spawnSync(FL 패턴) 143ms vs front `/api/afldb` 152ms
- 분해: 지연 ≈ **요청당 `spawnSync("node")`** (코드 `runtime/bootstrap.js` `nodeHttpRequest` + 측정)
- 티켓: `docs/CORE-TICKET-HTTP-SPAWN.md`
- 스크립트: `scripts/probe-fl-http.js`
- CRUD ~4s: **같은 축** (다회 순차 http_* × spawn)
- 겸사: verify 트레이드오프 TRAPS 한 줄 + /check 제안
- 회귀: 동작 변경 없음 (측정·문서만) · 보류 0/3 · 0/1

## 여기까지 / 남은 거리
여기까지: 원인 고정·재현·티켓.  
남은 거리: 코어에서 `nodeHttpRequest` in-process화 (본 레포에서 착수 금지).
