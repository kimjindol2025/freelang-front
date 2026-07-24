# CHECKPOINT — PERF-001 (2026-07-25)

## 목적지 (한 줄)
“느리다” → 재현 ms 분해 → 코어 없이 최대 병목 1개를 전/후 숫자로 줄인다.

## 목표치 (측정 후 제안·채택)
| 지표 | 전 (median) | 목표 | 후 |
|------|-------------|------|-----|
| GET `/clips/api` | 2568ms | ≤1200ms | **810ms** |
| GET `/clips` | 813ms | ≤500ms | **468ms** |
| GET `/api/afldb` | 1730ms | ≤400ms | **456ms** (미달·대폭 개선) |
| CRUD add+delete | 4329ms | (이번 비목표) | 4017ms |

## 병목 분해 (전)
`clips_api ≈ clips_all(~800) + afldb_status(~1570)`  
`afldb_status ≈ /verify(~826) + /stats via FL(~700)`  
SSR `/about` ~70ms → FL/SSR 자체는 작음.

## 개선
핫패스에서 `/verify` 제거 + 빈 batch skip. `/check`만 full verify.

## 미착수
| 후보 | 근거 |
|------|------|
| FreeLang `http_get` 고정지연(~400–700ms/콜, kv 2ms인데 FL 경로 수백 ms) | **코어** — 착수 금지. 다음 후보로 문서화 |
| afl-db `verify()` O(n) 자체 최적화 | afl-db 엔진 — front 범위 밖 |
| CRUD 쓰기 경로(~4s) | put+index 다회 HTTP. FL http 개선 선행이 이득 |

## 겸사
arity / builtin-arity hint 문구 보강.

## 보류 카운트
APP-DB rename 0/3 · 실장애 0/1

## 회귀
126r · 13h · codes 19 · humanShare 26 · build ok · coll CRUD 5종 ok
