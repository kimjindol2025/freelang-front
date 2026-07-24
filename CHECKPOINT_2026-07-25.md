# CHECKPOINT — freelang-front (2026-07-25)

## 한 줄
백엔드(afl-db)는 괘도. 프론트 언어는 **Trap → 구조화 진단 → /check 허브**까지 닫힘. 다음은 **오류 코드 카탈로그(P5)**.

## 확정된 아키텍처

| 이름 | 역할 | 포트 / PM2 |
|------|------|------------|
| afl-db | append-only KV/이벤트 | `:40610` / id 36 |
| freelang-front | FreeLang SSR/Island | `:40860` / id 68 |

- 프론트 데이터 백엔드 = **afl-db** (AFL-Core-2 아님)
- Next.js 전환 없음 · FreeLang bootstrap/코어 불변
- 언어 런타임 업글이 아니라 **앱/프레임워크 DX·진단**

## 이번 체크포인트 산출물 (P0–P4)

| 순위 | 내용 | 증거 |
|------|------|------|
| P0 | Trap 4종 | `fl-front-build.js` |
| P1 | 고신호 레거시 | metrics/vault/layout rename |
| P2 | `fl-diagnostics/1` | `node fl-front-build.js --json` |
| P3 | afldb batch/history | `_afldb.flx`, `/api/afldb` |
| P4 | `/check` readiness | afl-db + Build diagnostics 카드 |

문서: `PLAN_FRONT_LANG_2026-07-25.md`, `FIX_2026-07-25.md`, `docs/TRAPS.md`

## 검증 (체크 시점)

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
curl -sS http://127.0.0.1:40860/api/afldb
curl -sS -X POST http://127.0.0.1:40860/api/afldb \
  -H 'Content-Type: application/json' -d '{"action":"probe"}'
# /check → afl-db 사용 가능 + Build diagnostics 빌드 OK
```

필수 env: `FL_HTTP_ALLOW=127.0.0.1,localhost` (ecosystem에 반영됨)

## 진행방향 (다음 세션부터 — 묻지 말고 이 순서로)

### 완료: P5–P7 / Phase 1–4
- 카탈로그 · manifest · `--fix` · **`fl-front-loop.js` (`fl-loop/1`)**

### 다음
실사용 앱 3종 + **공통 컬렉션 모듈** (`_afldb_coll.flx`, `docs/AFLDB-COLL.md`)
새 afl-db 앱은 ns 등록 + thin `_db`만.

### 보류 (의도적)
- `APP-DB` 등 upper-hyphen 1개 대량 rename
- Next.js / bootstrap.js / 코어 문법 추가
- route-shadow·undefined-fn 등 기존 warn 대량 정리

## 세션 운영 규칙
1. 매 단계 끝날 때마다 빌드/`--json`/curl 검증
2. 단계마다 묻지 말고 P5→P6 순으로 진행
3. 의미 있는 묶음이 끝나면 다시 체크포인트(gogs+블로그)
