# CORE TICKET — FL `http_get` / `http_post` 요청마다 `spawnSync(node)` (2026-07-25)

**상태**: ✅ **해결** — HTTP-INPROCESS-001 (코어 `stdlib-http` → front `runtime/bootstrap.js` 함수단위 이식)  
**출처**: RUN-FL-COREPROBE-001 · 진단 커밋 `aa087d1`  
**재현/회귀**: `FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js --json`  
**코어 구현**: `freelang-v11/src/stdlib-http.ts` (상주 `worker_threads` + `Atomics.wait` + `receiveMessageOnPort`)

---

## 증상 (해결 전)

FreeLang front가 afl-db(`127.0.0.1:40610`)에 붙을 때, **백엔드가 1ms대인 요청도** FL 경로에서는 **~100–150ms+/콜**로 보였다.  
CRUD 왕복 ~4s도 같은 축(다수 순차 `http_*` × spawn)이었다.

---

## 숫자 — 해결 전 (책임 분리)

동일 URL `GET http://127.0.0.1:40610/stats` (COREPROBE 시점):

| # | 방법 | median |
|---|------|--------|
| A | Node `http.request` 직접 | **0.8 ms** |
| B | `spawnSync("node", ["-e", httpScript])` | **143.5 ms** |
| E | front `GET /api/afldb` | **151.8 ms** |
| F | front `GET /about` | **24.3 ms** |

---

## 숫자 — 해결 후 (2026-07-25 실측)

| 항목 | median | 기준 |
|------|--------|------|
| 코어 in-process 콜 (`measure-http-inprocess.js`) | **0.51 ms** | < 10 ms |
| front `/api/afldb` | **5.8 ms** | (이전 ~152 ms) |
| front `/about` | **27.5 ms** | 대조 |
| `afldb − about` | **−21.7 ms** | < 30 ms ✅ |
| clips add+delete | **56.6 ms** | < 1 s ✅ |
| SSRF (`FL_HTTP_ALLOW` 비움) | `127.0.0.1` / `169.254` 차단 | 보존 ✅ |

참고: `probe-fl-http.js`의 `spawnsync_*` 항목은 **구 패턴 대조용**으로 남겨 두었으며, 현재 런타임 경로가 아니다.

---

## 원인 (검증됨)

`runtime/bootstrap.js` `nodeHttpRequest`가 **매 요청** `spawnSync("node", ["-e", …])`를 호출 → 빈 spawn만 ~110–140ms.

## 수정

1. **코어**: `spawnSync` 제거 → 상주 worker + `MessageChannel` + `Atomics.wait`로 동기 HTTP.  
   주의: 메인 스레드 `Atomics.wait`는 이벤트 루프를 막으므로 **같은 프로세스**의 HTTP 서버로 호출하면 데드락. afl-db 등 **별도 프로세스**는 정상.
2. **front**: `nodeHttpRequest`만 동일 구현으로 교체. `flSsrfBlockReason` / `FL_HTTP_ALLOW` 가드는 **유지**.

---

## 완료 정의

- [x] `nodeHttpRequest`가 spawnSync 없이 in-process HTTP
- [x] 코어 콜당 median < 10 ms (실측 ~0.5 ms)
- [x] front `/api/afldb`가 `/about` 대비 +30 ms 이내 (실측 about보다도 빠름)
- [x] CRUD add+delete ≪ 1s (실측 ~57 ms)
- [x] SSRF 가드 보존
