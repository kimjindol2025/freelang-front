# 업무지시서 — 진단 커버리지 사각 축소판

**작성일**: 2026-07-25 KST  
**역할**: Cursor 구현자 · Codex 팀장 검수  
**집행 근거**: kim 지시 — FreeLang이 front에 약한 지점을 도구층/진단층/루프 검증으로 보강한다. `reserved-word let` 사각은 닫혔고, 다음은 같은 계열의 파서 의존 사각을 작은 범위에서 확인한다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.  
어긋나면 구현하지 말고 지시서를 고친다. 질문은 미완이 아니라 완성도다.

## 목적지

`let` 미진단처럼 얕은 토큰 스캔이나 공백 split 때문에 놓칠 수 있는 front 진단 사각을 1회 축소판으로 훑는다.

이번 작업의 부산은 다음이다.

- 현재 진단 코드 중 파서 의존 가능성이 큰 항목을 후보로 분류한다.
- 실제 미진단 증거가 있는 항목만 수정한다.
- 수정한 항목은 픽스처로 `검출 → 오검출 0 → 필요 시 fix → 재빌드`까지 확인한다.
- 새로 착수하지 않는 후보와 보류 사유를 문서에 남긴다.
- APP-DB rename, undefined-fn/route-shadow 일괄 정리는 해제 조건 전이므로 그대로 보류한다.

## 현재 기준선

착수 시점에 반드시 다시 재확인한다.

```bash
git status --short --branch
git log --oneline -5 --decorate
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-fix.js --dry
```

빌드 보고는 `summary.warnings`만 쓰지 말고 다음을 함께 적는다.

- `summary.stdlibLoadOk`
- `summary.stdlibLsFnsCount`
- `summary.stdlibLoadError` 유무

정본 기준선은 현재 Gogs master `672ffd4` 계열이다.

예상 기준:

- routes 126
- helpers 13
- diagnostic codes 19
- `stdlibLoadOk:true`
- warnings 26

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`
- FreeLang 코어, VM, `runtime/bootstrap.js` 변경 금지.
- HTTP-INPROCESS, afl-db backend, 서비스 포트, PM2 설정 변경 금지.
- APP-DB rename 착수 금지: `APP-DB rename 지적 0/3` 유지.
- undefined-fn / route-shadow 일괄 수정 금지: `undefined-fn/route-shadow 실장애 0/1` 유지.
- 기존 warnings 26을 줄이기 위한 대량 정리 금지.
- 공통 CSS 모듈 추가 금지. 공통 CSS는 문서화 보류 상태 유지.
- `logs/` 커밋 금지.
- `.build-state.json`, `AGENTS.md`는 검증 부산물이다. 별도 이유 없으면 커밋하지 않는다.
- `git add -A` 금지. 의도한 파일만 stage.
- push는 팀장 검수와 사용자 확인 후에만 한다.

## 작업 범위

### 1. stale 기록 정정

착수 전에 `CHECKPOINT_TRAP_LOOP_2026-07-25.md` 안의 낡은 상태 문구를 확인한다.

최소 확인:

- `push 보류`가 이미 push 완료된 커밋을 가리키면 실제 상태로 정정한다.
- 정정은 새 사실만 적고, 기존 실측 이력은 지우지 않는다.

### 2. 사각 후보 분류

현재 진단 코드 19개를 훑고 다음 세 그룹으로 나눈다.

| 그룹 | 의미 |
|------|------|
| 이번 검증 후보 | 문법 구조 안쪽을 봐야 해서 얕은 스캔 미진단 가능성이 있는 코드 |
| 문서만 후보 | 빌드 Trap으로 잡기 어렵거나 오검출 위험이 큰 코드 |
| 보류 | 해제 트리거 전이라 건드리면 안 되는 코드 |

최소 포함:

- `reserved-word`
- `let-shadow`
- `req-key-collision`
- `comment-defn`
- `builtin-arity`
- `nullable-consume`
- `str-loop-concat`
- `undefined-fn`
- `route-shadow`
- `upper-hyphen`

### 3. 픽스처

실제 미진단이 의심되는 항목만 픽스처를 만든다.

원칙:

- 픽스처는 `pages/` 임시 파일 또는 기존 테스트 방식 중 repo 관례에 맞춘다.
- 종료 시 임시 픽스처는 삭제하거나, 커밋할 필요가 있는 정식 fixture라면 이유를 문서에 남긴다.
- 문자열, 주석, 정상 코드에서 오검출 0을 확인한다.
- 검출만 필요한 항목과 자동수정까지 필요한 항목을 구분한다.

### 4. 구현 판단

수정은 미진단 증거가 있는 경우만 한다.

허용 위치:

- `fl-front-build.js`
- `fl-front-fix.js`
- `fl-diagnostic-codes.js`
- 필요한 문서: `docs/TRAPS.md`, `docs/AI-INTERFACE-ROADMAP.md`, `CHECKPOINT_TRAP_LOOP_2026-07-25.md`
- 필요한 경우 `FIX_2026-07-25-DIAG-COVERAGE-SWEEP.md`

새 diagnostic code를 만들려면 이유를 명시한다. 기존 오류 클래스 확장으로 충분하면 새 코드를 만들지 않는다.

### 5. 회귀 검증

필수 검증:

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-fix.js --dry
node fl-front-loop.js --dry
```

수정이 machine-applicable에 영향을 주면 추가 검증:

```bash
node fl-front-fix.js --dry
# 필요한 경우에만 fixture 대상으로 --fix 실행 후 재빌드
```

판정은 다음을 모두 포함한다.

- build `ok:true`, `errors:0`
- `summary.stdlibLoadOk:true`
- routes/helpers/codes 수 전후
- warnings 전후와 차이 사유
- 오검출 0 근거
- 자동수정이 있다면 오수정 0 근거

## 완료 기준

1. 착수 전 목적지 한 줄이 보고에 있다.
2. 진단 코드 후보 분류표가 문서 또는 보고에 있다.
3. 실제 미진단 증거가 있는 항목만 수정했다.
4. 수정한 항목은 픽스처로 검출된다.
5. 정상 코드·문자열·주석 오검출 0이 확인된다.
6. `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json`이 `ok:true`, `errors:0`, `stdlibLoadOk:true`다.
7. `node fl-front-loop.js --dry`가 무한루프 없이 종료한다.
8. APP-DB rename과 undefined-fn/route-shadow 보류 카운트가 `0/3 · 0/1`로 유지된다.
9. 후보 착수 0건과 남은 후보가 보고에 있다.
10. push는 팀장 검수 전 하지 않는다.

## 보고 양식

- 착수 전 이해한 목적지 한 줄
- 기준선 표: HEAD, dirty, routes/helpers/codes, `stdlibLoadOk`, warnings
- 진단 코드 후보 분류표
- 픽스처 목록과 기대 결과
- 구현 파일과 선택 이유
- 새 diagnostic code 여부와 이유
- 검증 명령과 결과
- 오검출 0 / 오수정 0 근거
- 후보 착수 0건 확인
- 보류 카운트 `APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1`
- 커밋 해시 전체
- 제외한 dirty 파일
- 여기까지 왔고, 남은 거리는 이것
