# FIX — 진단 커버리지 사각 축소판 (2026-07-25)

## 목적지
파서 의존 진단 사각을 1회 훑고, 미진단 증거가 있는 항목만 고친다.

## 후보 분류

| 그룹 | 코드 | 비고 |
|------|------|------|
| **이번 검증·수정** | `let-shadow` | `[^\]]*`가 중첩 `]`에서 끊김 → 미진단 증거·수정 |
| 이번 검증 후보(유지) | `reserved-word` | let은 DIAG-BLINDSPOT에서 이미 브래킷 매칭 |
| 이번 검증 후보(유지) | `req-key-collision`, `comment-defn`, `builtin-arity`, `nullable-consume`, `str-loop-concat` | 얕은 스캔 가능하나 **이번 미진단 증거 없음** → 미착수 |
| 문서만 | `upper-hyphen` | 레거시 일괄 rename 위험 |
| **보류** | `undefined-fn`, `route-shadow` | 실장애 0/1 |
| 보류(카운트) | APP-DB / upper-hyphen 일괄 | 0/3 |

## 미진단 증거
```lisp
(let [items [1 2 3]
      s "shadow"] …)   ; 수정 전 let-shadow 0건
(let [s "x"] …)         ; 단순형은 수정 전에도 검출
```

## 수정
`fl-front-build.js` `checkHelperLetShadow`:
1. 브래킷 매칭 + `topLevelLetBindings` (reserved-word와 동일)
2. `maskStringsPreserveLines` — playground 예제 문자열 속 `(let …)` FP 차단

새 diagnostic code 없음.

## 검증
- 검출: nested `s` → let-shadow
- 오검출 0: 주석 / `"s"` 문자열 / playground 예제
- fix: `s`→`sess` (count includes body)
- build: ok · warnings 26 · stdlibLoadOk true · 126r/13h/19c
- `fl-front-loop.js --dry` converged · 무한루프 0
