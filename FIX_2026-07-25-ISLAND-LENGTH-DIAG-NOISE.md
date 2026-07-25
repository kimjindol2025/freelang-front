# FIX — Island length 우선순위 + Overlay arity 노이즈 (2026-07-25)

## 증상
- `/people` API `items.length === 1` 인데 DOM `.pe-row` 0 / `.pe-empty` 1
- build warnings 26 → 32 (`ERROR-OVERLAY` JS를 FL 호출로 오인)

## 원인
1. Island `(length x)` → `(x)?.length ?? 0` — `??`가 `===`보다 낮아 `((visible())?.length ?? 0 === 0)` 이 length≥1 일 때 truthy
2. `validateArity`가 삼중따옴표 문자열 내용을 마스킹하지 않아 `appendChild(badge)` / `function(f)` 등을 `(badge)` `(f)` 호출로 집계

## 수정
| 파일 | 변경 |
|------|------|
| `island-compiler.js` | `length` emit → `((…)?.length ?? 0)` |
| `fl-front-build.js` | `validateArity` / `checkBuiltinArity` → `maskStringsPreserveLines(stripComments(…))` |

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-loop.js --dry
# /people hard reload: .pe-row=1, .pe-empty=0
# /dev/error-demo overlay 유지
```

실측 (2026-07-25 20:05):
- build ok · errors 0 · **warnings 25** · stdlibLoadOk true · lsFns 485
- loop converged · remainingFixableCount 0
- `/people` CDP: itemsLen=1 · pe-row=1 · pe-empty=0 · api=1
- overlay: click→list1·block · Esc→badge

### warnings 기대 26 vs 실측 25
지시서 기대는 Overlay 신규 arity 6건만 제거(32→26).
문자열 마스킹이 **기존 기준선에 섞여 있던 arity FP 1건**도 같이 제거해 25가 됨.
구성: undefined-fn2 + global-shadow14 + route-shadow6 + str-loop-concat3 = **25**. arity/_layout **0**.
