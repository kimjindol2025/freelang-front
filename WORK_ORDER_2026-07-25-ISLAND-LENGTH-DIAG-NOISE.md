# 업무지시서 — Island length 우선순위 + Error Overlay 진단 노이즈 마감

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: Error Overlay 검수 중 `/people` 하드 리프레시에서 API 데이터는 들어오지만 목록이 비는 회귀와 `_layout.flx` 신규 arity 경고 6건을 확인했다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> `/people`의 non-empty items가 빈 목록으로 렌더되는 `length` 컴파일 우선순위를 고치고, Error Overlay JS 문자열 때문에 늘어난 진단 경고를 0으로 되돌린다.

## 목적지

Error Overlay 자체는 headless Chrome 검수에서 동작했다.

이번 작업의 목적지는 두 가지 좁은 마감이다.

1. Island 컴파일 결과의 `?.length ?? 0 === 0` 우선순위 회귀를 고친다.
2. `_layout.flx`의 `ERROR-OVERLAY` 삼중따옴표 JavaScript 때문에 생긴 arity 오진단 6건을 없앤다.

## 현재 검수 증거

### 오버레이 동작 OK

Chrome headless + CDP:

- `/dev/error-demo`에서 `window.__FL_EO` 존재.
- 버튼 클릭 후 `__FL_EO.list().length === 1`.
- overlay root `display: block`, `RUNTIME ERROR` 표시.
- Esc 후 root `none`, badge `block`.
- Ctrl+Shift+E 후 root `block`.
- Clear 후 list `0`, root `none`.
- 직접 `__FL_EO.report` 2건 후 `2 / 2`, 왼쪽 화살표 후 `1 / 2`.

### 남은 회귀

`/people` 하드 리프레시:

- browser Performance 기준 `/people/api` 요청 1회. 429 루프는 닫힘.
- `window._fl.hmr_snapshot().islands["island-peopleapp-0"].data.items.length === 1`.
- 화면 DOM은 `.pe-row` 0, `.pe-empty` 1.
- 원인: 컴파일 결과가 `((visible())?.length ?? 0 === 0)` 형태다. JS 우선순위상 length 1이면 조건이 truthy라 빈 목록 분기로 간다.

### 진단 회귀

기준 warnings 26 → 현재 warnings 32.

신규 6건은 `_layout.flx` 내부 `ERROR-OVERLAY` 삼중따옴표 JavaScript에서 나온 arity 오진단:

- line 382 `(badge) 인자 4개 필요, 0개 전달`
- line 401 `(f) 인자 1개 필요, 0개 전달`
- line 406 `(f) 인자 1개 필요, 0개 전달`
- line 456 `(f) 인자 1개 필요, 0개 전달`
- line 482 `(row) 인자 1개 필요, 0개 전달`
- line 492 `(row) 인자 1개 필요, 0개 전달`

## 금지선

- FreeLang core/runtime 변경 금지. 필요하면 `freelang-front` compiler/build 진단 쪽만.
- Error Overlay UX 대개편 금지. 이미 동작 확인됨.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- `HANDOFF.airc`, `logs/`, `*.db` 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- push/blog는 팀장 검수 후.

## 완료 기준

### 1. length 우선순위

다음 형태가 JS에서 올바르게 false가 되어야 한다.

```js
((items)?.length ?? 0) === 0
```

또는 동등하게 안전한 컴파일 결과.

검증:

- `/people` hard reload 후 browser snapshot에서 `items.length === 1`.
- DOM `.pe-row === 1`, `.pe-empty === 0`.
- `/people/api` request count는 1회 수준으로 유지.

### 2. Error Overlay 유지

검증:

- `/dev/error-demo` 버튼 클릭 → overlay root `block`, `__FL_EO.list().length === 1`.
- Esc → badge visible.
- Ctrl+Shift+E → overlay reopen.
- `__FL_EO.report` 2건 → `2 / 2`, ←/→ 이동 가능.
- Clear → list 0.

### 3. 진단 기준선

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-loop.js --dry
```

기대:

- build ok.
- errors 0.
- warnings 25로 복귀.
- `stdlibLoadOk true`.
- `stdlibLsFnsCount 485`.
- loop `converged true`.
- `remainingFixableCount 0`.

비고:

- 처음 지시서의 26은 Overlay 신규 arity 6건만 제거한다는 중간 가정이었다.
- 문자열 마스킹이 기존 기준선에 있던 arity FP 1건도 같이 제거하므로 정본은 25다.
- 구성: undefined-fn 2 + global-shadow 14 + route-shadow 6 + str-loop-concat 3.

## 보고 양식

보고는 완료 단정 대신 아래 형식으로 한다.

```md
목적지 한 줄:

검증 결과:
- build:
- loop:
- /dev/error-demo CDP:
- /people CDP:

수정 파일:

남긴 것:
- dirty:
- 보류 카운트:

판단:
- length 우선순위 원인:
- 진단 32→25 복귀 근거:
```
