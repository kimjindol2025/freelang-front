# PLAN — FreeLang Front 언어 발전 (2026-07-25)

## 목표
백엔드(afl-db)는 괘도. 프론트는 **코어 불변**, 위에 DX/진단/데이터 헬퍼를 얹어
AI·사람이 같은 패턴으로 화면을 쌓아도 안 깨지게 한다.

Next 전환 없음. 문법 대량 추가 없음.

## 원칙
1. FreeLang bootstrap/코어 손대지 않음
2. 함정은 빌드가 잡는다 (Trap Checker)
3. 진단은 기계가 읽는다 (`--json`)
4. 데이터는 afl-db 헬퍼로 짧게
5. 한 단계 끝날 때마다 빌드 검증 — 물어보지 말고 다음 우선순위로 진행

## 우선순위

| 순위 | 항목 | 상태 | 완료 기준 |
|------|------|------|-----------|
| P0 | Trap Checker 4종 (json-parse / upper-hyphen / let-shadow / FL_HTTP_ALLOW) | ✅ | 빌드 warn 출력 |
| P1 | Trap이 잡은 **고신호** 레거시 정리 | ✅ | json-parse 0, let-s 정리, upper-hyphen≥2만, vault/layout rename |
| P2 | `fl-build --json` 구조화 진단 (AI-Interface Phase 1) | ✅ | `schema: fl-diagnostics/1` + summary + exit1 on error |
| P3 | afl-db 데이터 헬퍼 보강 | ✅ | batch-get/put, history + API |
| P4 | `/check`를 “프론트 readiness” 고정 허브 | ✅ | afl-db + build diagnostics 카드 |
| P5 | 오류 코드 카탈로그 → manifest (Phase 2) | 다음 | 코드별 fixable 메타 |
| P6 | 안전 자동수정 (Phase 3) | 이후 | hyphen↔underscore 등 machine-applicable만 |

## P1 범위 (이번 진행)
- `json-parse` 잔여 → `json_parse` (완료에 가깝게)
- `let [s …]` 가 style 헬퍼를 가리는 **실사용 경로**만 rename (vault 등)
- `upper-hyphen`(`APP-DB` 등)은 **일괄 리네임하지 않음** — 노이즈·회귀 큼. 신규 금지 + 문서화만
- AGENTS.md / FIX에 함정 목록 반영

## P2 범위
- 기존 `--json`이 buildState만 뿌림 → `fl-diagnostics/1` 스키마로 diagnostics 배열 정리
- `code`/`severity`/`file`/`line`/`message`/`hint`
- error 있으면 exit 1 (JSON_MODE에서도)

## P3 범위
- `afldb-keys-prefix` 또는 HTTP API가 있으면 활용, 없으면 get/put/status 문서화 + probe 유지
- 페이지 작성 패턴 1개 예제 (`/check` 또는 작은 demo)

## 하지 않음
- Next.js 도입
- bootstrap.js 수정
- 전역 `APP-DB` → `app_db` 대량 rename (별도 마이그레이션 태스크)

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json | head
curl -sS http://127.0.0.1:40860/api/afldb
```

## 체크포인트 (2026-07-25)
- P0–P4 완료 · 증거: `CHECKPOINT_2026-07-25.md`, `docs/TRAPS.md`
- **다음 진행방향 = P5만** (오류 코드 카탈로그 → manifest). P6은 P5 완료 후.
- 세션 시작 시: 이 PLAN + CHECKPOINT 읽고 묻지 말고 P5부터.
