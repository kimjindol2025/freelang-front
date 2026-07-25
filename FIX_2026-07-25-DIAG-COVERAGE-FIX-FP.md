# FIX — let-shadow fix 오수정 차단 (2026-07-25)

## 목적지
`6647e07` SWEEP 보완: build 진단은 통과했으나 `fl-front-fix.js`가 주석/문자열 속 `(let …)`를 고치던 사각을 닫는다.

## 원인
| 층 | 동작 |
|----|------|
| **build** (`checkHelperLetShadow`) | `stripComments` + `maskStringsPreserveLines` 후 스캔 → 주석/문자열 FP **0** |
| **fix** (`fixLetShadow`, 수정 전) | raw 소스에 `/\(let\s+\[/` → 주석·문자열 안도 rename 대상 |

실패 지점은 진단이 아니라 **fix 오수정 방지**.

## 수정
1. `fl-front-fix.js`: `findNextLet`를 모듈 공통으로 두고 (`reserved-word`와 동일) 주석(`;` / `#|`)·문자열·삼중따옴표 바깥의 `(let`만 처리. 바인딩/본문 rename도 `mapOutsideStrings`.
2. `fl-front-build.js`: `stripComments`에 `#|…|#` 스킵 추가 (build 블록 주석 오검출 정합).

새 diagnostic code 없음.

## 검증 (임시 fixture, 종료 후 삭제)

| 케이스 | build let-shadow | fix --dry |
|--------|------------------|-----------|
| nested `(let [items […] s …])` | 1 | 후보 있음 (count 2) |
| `; (let [s …])` + 문자열 속 `(let [h …])` | 0 | filesChanged 해당 파일 없음 |
| `#| (let [s …]) |#` | 0 | count 0 |
| 정상 `sess` | 0 | 0 |

레포 본문: warnings **26**, `fix --dry` filesChanged **0**, loop `converged` · `remainingFixableCount:0`.

## 구분
- **build 진단 FP 0** — 문자열/줄주석은 SWEEP에서, `#|`는 이번 stripComments.
- **fix 오수정 0** — findNextLet + mapOutsideStrings.
