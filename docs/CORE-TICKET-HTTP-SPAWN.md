# CORE TICKET — FL `http_get` / `http_post` 요청마다 `spawnSync(node)` (2026-07-25)

**상태**: 진단 완료 · **코어 착수 대기** (front에서 고치지 말 것)  
**출처**: RUN-FL-COREPROBE-001 · 기준 커밋 `c1ee6f3` (PERF 이후)  
**재현 스크립트**: `node scripts/probe-fl-http.js --json`  
(`FL_HTTP_ALLOW=127.0.0.1,localhost`)

---

## 증상

FreeLang front가 afl-db(`127.0.0.1:40610`)에 붙을 때, **백엔드가 1ms대인 요청도** FL 경로에서는 **~100–150ms+/콜**(부하 시 수백 ms)로 보인다.  
PERF-001 이후 목록의 `/verify`는 제거됐지만, `/stats` 한 번·KV 한 번에도 같은 바닥 지연이 남는다. CRUD 왕복 ~4s도 같은 축이다.

---

## 숫자 (책임 분리)

동일 URL `GET http://127.0.0.1:40610/stats` (머신 실측, `PROBE_N=7` 중앙값, COREPROBE 실행 시점):

| # | 방법 | median |
|---|------|--------|
| A | Node `http.request` 직접 (FL 밖) | **0.8 ms** |
| B | `spawnSync("node", ["-e", httpScript])` — **bootstrap `nodeHttpRequest`와 동일 패턴** | **143.5 ms** |
| C | `spawnSync("node", ["-e", "ok"])` 네트워크 없음 | **123.4 ms** |
| D | spawn + `require('http'|'https'|'url')`만 | **139 ms** |
| E | front `GET /api/afldb` (= FL `http_get` `/stats` 1회 + SSR) | **151.8 ms** |
| F | front `GET /about` (afl-db 없음) | **24.3 ms** |

유도:

| 식 | 값 | 의미 |
|----|-----|------|
| B − A | **~143 ms** | 같은 URL인데 FL식 경로만의 몫 |
| B − D | **~4.5 ms** | 자식 안에서의 실제 HTTP+JSON (거의 전부 spawn) |
| E − F | **~128 ms** | 요청 안에서 FL http 1회 대략치 ≈ B |
| E − B | **~8 ms** | front 조립 추가분 (작음) |

타이트 재확인 (`n=11`): direct **1.3 ms** · spawnSync-http **144 ms** · empty spawn **109 ms** · **비율 ~108×**.

`/verify`(백엔드 자체 ~800–900ms)는 별개 — PERF에서 핫패스 제거 완료. 본 티켓은 **빠른 엔드포인트**의 FL 바닥 비용.

---

## 재현 명령

```bash
cd /home/kim/kim/skl/freelang-front
# afl-db :40610 · freelang-front :40860 online
FL_HTTP_ALLOW=127.0.0.1,localhost node scripts/probe-fl-http.js --json

# 대조
curl -sS -o /dev/null -w '%{time_total}\n' http://127.0.0.1:40610/stats
curl -sS -o /dev/null -w '%{time_total}\n' http://127.0.0.1:40860/api/afldb
```

---

## 원인

### 검증됨 (코드 + 측정)

1. **코드**: `runtime/bootstrap.js` `nodeHttpRequest` (약 L26006–26028)가  
   **매 요청** `child_process.spawnSync("node", ["-e", <인라인 HTTP 스크립트>], …)` 를 호출한다.  
   `http_get` / `http_post` / `http_delete` 등이 이를 사용.
2. **측정**: 동일 URL에서 direct HTTP는 1ms대, spawnSync 복제본은 ~140ms이고,  
   그 중 **~110–140ms는 빈 spawn·모듈 로드**이며 네트워크는 ~수 ms.
3. **front 경로**: `/api/afldb` 지연 ≈ spawnSync 1회 + 소량 SSR — 추가 미스터리 없음.

### 추측 (미검증 · 우선순위 낮음)

- spawn 비용은 머신 부하·cold page cache에 따라 100–700ms로 흔들릴 수 있음 (PERF 당시 `/api/afldb` ~450ms).
- DNS/SSRF 가드(`flSsrfBlockReason`)는 hostname 문자열 검사만 — 본 지연의 주원인 아님(검증됨: allow 설정 후에도 spawn이 지배).

---

## CRUD ~4s 같은 축인가?

**예 — 같은 축으로 판정.**

`afldb-coll-create` ≈ `put` + `index-get` + `index-put`, 이후 응답 `*-all` ≈ `index-get` (+ 빈 batch skip).  
add 한 번에 **≥4회** 순차 `http_*` → **≥4× spawnSync**. delete 유사.  
add+delete 왕복 ≥8회 × ~140ms ≈ **≥1.1s** 하한; PERF 관찰 ~4s는 콜당 spawn이 더 비쌀 때(또는 콜 수 더 많을 때)와 정합.

별도 “쓰기 엔진 버그”를 가정할 근거 없음. **http를 in-process로 바꾸면 CRUD도 같이 내려감.**

---

## 코어 쪽 개선 후보 (제안만 · 착수 금지)

1. **`nodeHttpRequest`를 프로세스 내 `http`/`https` 요청으로 교체** (동기면 `Atomics`/`deasync` 없이 가능한 기존 패턴 조사, 또는 async+서버 wait 계약).  
   → 기대: 빠른 KV/stats가 **수 ms**로, CRUD가 **수×10ms** 규모로.
2. 차선: **keep-alive 장기 자식 워커 1개**에 요청 파이프 — spawn 제거, 구현 복잡.
3. 하지 말 것: front에서 status 캐시·가짜 batch로 spawn 횟수만 줄이기(정합성·복잡성). 근본은 런타임.

수정 위치 후보: freelang-v11 stdlib/http 런타임 → freelang-front `runtime/bootstrap.js` 동기화.

---

## front에서 불가능한 이유

- `http_get` 구현이 **코어/번들 런타임**에 있음. front 페이지·헬퍼는 그걸 호출할 뿐.
- front 최적화(호출 횟수 줄이기)는 PERF의 verify 분리처럼 **일부만** 가능. 콜당 바닥 ~100ms+는 제거 불가.

---

## 겸사 — verify 트레이드오프 (PERF 마감)

목록 API의 `afldb-status`는 **`/stats`만** (`verified: false`).  
전체 로그 `/verify`는 **`/check`·`(afldb-verify)`** 에서만.  

의미: 상시 무결성 스캔 → **점검 시 검증**.  
제안: 운영자가 가끔 `curl -sS http://127.0.0.1:40860/check` 또는 cron으로 `/check`·`/verify` 확인 (자동 cron은 이번 미착수 — 제안만).

---

## 완료 정의 (코어 트랙)

- [ ] `nodeHttpRequest`가 spawnSync 없이 in-process HTTP
- [ ] `scripts/probe-fl-http.js`: B≈A (수 ms) 또는 B−A < 10ms
- [ ] front `/api/afldb` ≈ `/about` + 수 ms
- [ ] CRUD add+delete ≪ 1s (동일 데이터 규모)
