# CHECKPOINT — DIAGCOV-001 (2026-07-25)

## 목적지 이해
문서/스캐폴드 금지만으로 막힌 사각을 **빌드·루프 진단**으로 올린다. humanShare에는 사람 판단만.

## 승격

| 패턴 | 등급 | 코드 | 결과 |
|------|------|------|------|
| `(get body "text")` / `form-get "text"` / `:name "text"` | Trap + machine fix | `req-key-collision` (19번째) | 검출·오검출·apply+재빌드 PASS |
| 교육용 문장 속 `(defn` (comment-defn 오탐) | 검출 축소 (승격≠삭제) | `comment-defn` | humanShare −2 |

## humanShare 28 → 26
`26 = undefined-fn 2 + arity 1 + global-shadow 14 + route-shadow 6 + str-loop-concat 3`  
(−2 = examples 01/04 교육 주석이 comment-defn에서 제외)

## 비승격 (판단)
| 패턴 | 이유 |
|------|------|
| route-shadow 6 · undefined-fn 2 | 지시서 금지 · 실장애 0/1 유지. 일괄 수정 금지 |
| global-shadow 14 · str-loop-concat 3 | 자동 rename/리라이트 위험 > 이득. 사람몫 유지 |
| arity 1 | 시그니처 추정 불확실 → 힌트 등급 유지 |
| action/id/body 키 | API 프로토콜·의도적 body 사용 — Trap 확대 시 오탐 폭증 |

## 잔가지
1. **`fl-scaffold --dry`**: `--fields content` → `fl-scaffold/1` dry 계획 JSON. `--fields text`는 BLOCKED_FIELDS로 즉시 거부(예상).
2. **31→28 (−3)**: AUTOPILOT 시작 스냅샷 31 vs 클린 트리 확정 28. 코드별 3건 소재는 당시 스냅샷 미보관(픽스처·일시 경고 추정). 확정 분해는 CHECKPOINT_AUTOPILOT의 28식.

## 보류 카운트
APP-DB rename 지적 **0/3** · undefined-fn/route-shadow 실장애 **0/1**

## 회귀
126 routes · 13 helpers · collections 5 · build ok · diagnosticCodeCount 19
