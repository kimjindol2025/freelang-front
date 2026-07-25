# 업무지시서 — DIAG-COVERAGE-SWEEP 보완: let-shadow fix 오수정 차단

**작성일**: 2026-07-25 KST  
**역할**: Cursor 구현자 · Codex 팀장 검수  
**집행 근거**: Codex 팀장 검수에서 `6647e07` push 보류. `fl-front-build.js` 진단은 통과했지만, `fl-front-fix.js --dry`가 주석/문자열 속 `(let …)` 예제를 `let-shadow` 수정 대상으로 잡는 오수정 사각이 확인됨.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.  
어긋나면 구현하지 말고 지시서를 고친다. 질문은 미완이 아니라 완성도다.

## 목적지

`DIAG-COVERAGE-SWEEP`의 미완 지점 하나만 닫는다.

이번 작업의 부산은 다음이다.

- `fl-front-fix.js`의 `let-shadow` 자동수정이 주석/문자열 안의 `(let …)`를 고치지 않게 한다.
- `fl-front-build.js`에서 닫은 중첩 `]` 검출 능력은 유지한다.
- nested 실제 코드에서는 fix 후보가 나오고, 주석/문자열 fixture에서는 `filesChanged:0`이어야 한다.
- 새 diagnostic code 없이 기존 `let-shadow` 계약을 맞춘다.
- 보완 완료 후 `6647e07` 포함 최종 커밋을 팀장 검수 대상으로 보고한다. push는 하지 않는다.

## 현재 기준선

착수 시점에 반드시 다시 재확인한다.

```bash
git status --short --branch
git log --oneline -5 --decorate
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-fix.js --dry
node fl-front-loop.js --dry
```

현재 예상 상태:

- HEAD: `6647e07febe554b84276f4123eec4b6b41018d32`
- branch: `master...origin/master [ahead 1]`
- build: `ok:true`, routes 126, helpers 13, codes 19, warnings 26
- `stdlibLoadOk:true`, `stdlibLsFnsCount:485`
- repo 본문 기준 `fix --dry`: `filesChanged:0`
- known dirty 제외: `.build-state.json`, `AGENTS.md`, `logs/`

## 팀장 재현 증거

Codex 검수에서 isolated worktree에 아래 fixture를 넣고 확인했다.

```lisp
; pages/__codex_diag_nested.flx
(defn render [req]
  (let [items [1 2 3]
        s "shadow"]
    (str s)))
```

```lisp
; pages/__codex_diag_fp.flx
; (let [s "comment"] s)

(defn render [req]
  (let [safe "literal (let [h \"string\"] h)"
        value "ok"]
    (str safe value)))
```

결과:

- `fl-front-build.js --json`: nested만 `let-shadow` 1건, FP 파일 0건.
- `fl-front-fix.js --dry`: FP 파일도 `let-shadow count 4`로 변경 대상.

따라서 실패 지점은 build 진단이 아니라 **fix 오수정 방지**다.

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`
- FreeLang 코어, VM, `runtime/bootstrap.js` 변경 금지.
- `fl-front-build.js` 추가 리팩터는 필요할 때만. 이번 주 대상은 원칙적으로 `fl-front-fix.js`.
- APP-DB rename 착수 금지: `APP-DB rename 지적 0/3` 유지.
- undefined-fn / route-shadow 일괄 수정 금지: `undefined-fn/route-shadow 실장애 0/1` 유지.
- 기존 warnings 26을 줄이기 위한 대량 정리 금지.
- 공통 CSS, afl-db, HTTP-INPROCESS, PM2 변경 금지.
- `logs/` 커밋 금지.
- `.build-state.json`, `AGENTS.md`는 검증 부산물이다. 별도 이유 없으면 커밋하지 않는다.
- `git add -A` 금지. 의도한 파일만 stage.
- push는 팀장 검수와 사용자 확인 후에만 한다.

## 작업 범위

### 1. fix 대상 탐색 보정

`fl-front-fix.js`의 `fixLetShadow`가 주석/문자열 바깥의 실제 `(let [`만 찾게 한다.

구현 방식은 재량이지만 완료 기준은 고정한다.

- line comment `; ...` 안의 `(let [`는 무시한다.
- block comment `#| ... |#` 안의 `(let [`는 무시한다.
- 일반 문자열 `"..."` 안의 `(let [`는 무시한다.
- escape 포함 문자열 안의 `(let [`는 무시한다.
- 실제 코드의 nested binding vector는 계속 처리한다.

### 2. fixture 검증

검증 fixture는 임시 파일이어도 된다. 종료 후 삭제하거나, 정식 fixture로 커밋할 경우 이유를 문서에 남긴다.

필수 케이스:

| 케이스 | 기대 |
|--------|------|
| 실제 코드 `(let [items [1 2 3] s ...])` | build `let-shadow` 검출, fix 후보 있음 |
| 주석 `; (let [s ...])` | build 0, fix `filesChanged:0` |
| 문자열 `"literal (let [h ...])"` | build 0, fix `filesChanged:0` |
| 정상 let 이름 | build 0, fix `filesChanged:0` |

### 3. 문서 보강

필요한 문서만 갱신한다.

허용:

- `FIX_2026-07-25-DIAG-COVERAGE-SWEEP.md`
- `CHECKPOINT_TRAP_LOOP_2026-07-25.md`
- `docs/TRAPS.md`
- `docs/AI-INTERFACE-ROADMAP.md`
- 필요 시 별도 `FIX_2026-07-25-DIAG-COVERAGE-FIX-FP.md`

문서에는 “build 진단 FP 0”과 “fix 오수정 0”을 구분해서 적는다.

## 회귀 검증

필수:

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-fix.js --dry
node fl-front-loop.js --dry
```

추가로 fixture 대상에서 아래를 보고한다.

- nested 실제 코드: `let-shadow` 검출 수
- FP fixture: `fl-front-build.js --json` let-shadow 0
- FP fixture: `fl-front-fix.js --dry` `filesChanged:0`
- nested fixture: `fl-front-fix.js --dry` let-shadow 후보 있음

## 완료 기준

1. 착수 전 목적지 한 줄이 보고에 있다.
2. `fl-front-fix.js`가 주석/문자열 안의 `(let …)`를 수정 대상으로 잡지 않는다.
3. 실제 nested let-shadow 코드는 build에서 검출된다.
4. 실제 nested let-shadow 코드는 fix 후보가 된다.
5. 주석/문자열/정상 let fixture는 build 0, fix `filesChanged:0`이다.
6. repo 본문 기준 `node fl-front-fix.js --dry`는 `filesChanged:0`이다.
7. `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json`이 `ok:true`, `errors:0`, `stdlibLoadOk:true`다.
8. `node fl-front-loop.js --dry`가 `converged:true`, `remainingFixableCount:0`이다.
9. APP-DB rename과 undefined-fn/route-shadow 보류 카운트가 `0/3 · 0/1`로 유지된다.
10. push는 팀장 검수 전 하지 않는다.

## 보고 양식

- 착수 전 이해한 목적지 한 줄
- 기준선 표: HEAD, dirty, routes/helpers/codes, `stdlibLoadOk`, warnings
- 원인: 왜 build는 통과했고 fix는 FP였는지
- 구현 파일과 선택 이유
- fixture 표: nested / 주석 / 문자열 / 정상 let
- 검증 명령과 결과
- 오검출 0 / 오수정 0 근거
- 보류 카운트 `APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1`
- 커밋 해시 전체
- 제외한 dirty 파일
- 여기까지 왔고, 남은 거리는 이것
