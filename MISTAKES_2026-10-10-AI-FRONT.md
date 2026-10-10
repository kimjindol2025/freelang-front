# AI-Front 검수 인수인계 — 2026-10-10

## 현재 결론

FreeLang Front는 현재 이 서버의 내부 코딩용으로 사용할 수 있는 상태다.
이번 검수에서 보안 경계, HMR, 생성 artifact 회귀를 보완했고, 실제 내부
release gate에서 기능 검사는 통과했다. 외부 공개 상용 배포로 판정하지 않는다.

정교화 작업 후 현재 build diagnostics는 `errors=0, warnings=0`이다.
계약 baseline은 `npm run contracts:verify`가 실제 build PASS를 확인한 뒤
갱신하며, baseline-only 문서 커밋은 소스 변경과 구분한다.

## 이번에 고친 문제

1. playground API가 요청 코드를 임시 파일에 쓰고 런타임으로 실행하던 경로에
   인증 경계가 없었다.
   - `FL_DEV=1`과 세션 인증 또는 `FL_PLAYGROUND_TOKEN`이 모두 필요하다.
   - 코드 크기는 4000자로 제한한다.
   - timeout, 실행 오류, 잘못된 요청에 HTTP 상태를 구분한다.
   - 런타임 bootstrap 경로는 `FL_RUNTIME_BOOTSTRAP`으로 지정할 수 있다.
2. dev-server의 HMR API가 모든 Origin을 허용하고 HMR 포트를 외부 주소에
   열 수 있었다.
   - HMR은 `127.0.0.1`에만 bind한다.
   - 앱의 localhost/127.0.0.1 Origin만 허용한다.
3. `/~ai/test`의 `file` 인자가 `pages/` 밖으로 탈출할 수 있었다.
   - `pages/` 내부의 `.flx`만 테스트하도록 경계를 고정했다.
4. AI 함수 목록 정규식이 `?`, `!` predicate/action 함수명을 누락했다.
5. browser artifact로 생성되는 `date-add-days` 정규식 escape가 깨져 있었다.
   - 생성 결과에 대한 별도 conformance 회귀 검사를 추가했다.
6. HMR 서버 재기동 readiness가 5초로 짧아 정상 기동 직후 false failure가
   발생했다.
   - 재시도/안전망을 15초 범위로 늘렸다.
7. 내부 코딩 서버의 FreeLang 진입점이 `127.0.0.1`에만 bind하도록 명시했다.

## 오늘의 실수와 재발 방지

### 실수 1 — 정적 코드만 보고 playground를 안전하다고 판단

`shell-exec-stdout` 호출이 있는지만 보고 인증 경계를 확인하지 않았다.
사용자 입력이 FreeLang runtime으로 전달되는지, 누가 호출할 수 있는지를
endpoint 단위로 함께 봐야 한다.

재발 방지: API review에서 다음 세 항목을 한 묶음으로 확인한다.

- 인증/권한
- 입력 크기·경로·명령 경계
- timeout·오류 상태·정리(cleanup)

### 실수 2 — dev-server를 샌드박스에서 실행하고 포트 권한 문제를 코드 문제로 혼동

초기 HMR 재검수는 `listen EPERM`을 readiness 문제처럼 보이게 했다.
실제 서버 로그와 실행 환경 권한을 분리해서 확인해야 한다.

재발 방지: HTTP/HMR 계약은 loopback bind 권한이 있는 환경에서 실행하고,
실패 시 `listen` 오류를 먼저 확인한다.

### 실수 3 — 생성 artifact의 escape를 source conformance만으로 놓침

compiler source가 맞아 보여도 template literal을 거친 `_app.fl` 결과는
달라질 수 있다.

재발 방지: 소스 검사와 생성 artifact 검사를 반드시 모두 둔다.

### 실수 4 — 기존 warning을 전부 기능 실패처럼 처리할 뻔함

현재 warning 23개는 build error가 아니라 휴리스틱 경고다. 숫자만 줄이기
위해 앱 코드나 언어 규칙을 무리하게 바꾸지 않는다.

## 검증 근거

실행한 핵심 검수:

```text
npm run verify:internal
```

결과:

- build: PASS, errors=0, warnings=0
- language conformance: PASS
- language diagnostics: PASS
- collection adapter: PASS
- HMR contract: PASS
- UI/state/typecheck: PASS
- regression fixtures: PASS
- real HTTP, SSE, SPA smoke: PASS

추가로 실제 loopback 권한 환경에서 다음 보안 회귀를 확인했다.

- `/~ai/test?file=../../etc/passwd` 차단
- `front-collection-memory?` 함수 목록 유지
- 무인증 `/api/playground/eval` → 403
- CSS reload → soft reload → build-error 이벤트 순서

## 정교화 전 warning 분류와 처리

정교화 전 23개는 다음 네 부류였다.

- `global-shadow`: 14개 — 짧은 매개변수 이름이 전역 helper를 가림
- `contract-readiness`: 5개 — 계약/준비 상태 휴리스틱 경고
- `str-loop-concat`: 3개 — loop/reduce 안 문자열 누적의 성능 경고
- `fl-http-allow`: 1개 — HTTP allow 설정 확인 경고

`contract-readiness` 5개는
문법/라우트/smoke 실패가 아니라 계약 문서가 가리키는 마지막 검증 커밋
`f0e4a02`와 현재 head가 달라진 상태다. 따라서 다음 순서는 계약 5개를
현재 head에서 재검증해 baseline을 갱신하는 것이다. 이 경고를 단순히 끄면
안 된다.

다음처럼 처리해 현재 warning 0으로 만들었다.

- `global-shadow`: triple-quoted HTML/CSS 오탐과 `$` capture parameter를
  제외하고, 실제 짧은 파라미터는 의미 있는 이름으로 변경했다.
- `str-loop-concat`: `_charts.flx`를 배열/`str-join` 조합으로 변경했다.
- `fl-http-allow`: package/ecosystem 실행 계약 선언을 build checker가 확인한다.
- `contract-readiness`: `npm run contracts:verify`가 실제 PASS 뒤 baseline을
  갱신하고, baseline-only 문서 커밋은 유효한 것으로 판정한다.
- 진단 contract: 모든 diagnostic이 `code/severity/file/line/column/message/
  hint/fixable/applicability`를 갖는지 회귀 테스트한다.

warning을 숨기거나 검수 기준을 낮추지 않고, 실제 위험과 문서 baseline을
분리했다.

## 다음 언어 정교화 순서

### 1단계 — 진단 위치와 심각도 모델

- 모든 진단에 `code`, `severity`, `file`, `line`, `col`, `hint`를 고정한다.
- parser/build/runtime 오류를 같은 JSON schema로 통합한다.
- warning과 error의 gate 처리 기준을 명시한다.

### 2단계 — 타입·계약 진단

- route handler의 요청/응답 계약을 추적한다.
- `server-json`, `fetch!`, `atom`, `store`의 기본 shape를 문서화한다.
- AI가 고칠 수 있도록 오류마다 최소 재현 예제와 수정 힌트를 제공한다.

### 3단계 — deterministic artifact

- `.flx` → `_app.fl` → browser JS 각 단계의 source map/위치를 연결한다.
- 생성 결과 escape, route order, helper order를 결정적으로 고정한다.

### 4단계 — AI용 안전한 자동 수정

- 괄호·식별자·함수명 같은 기계적 수정부터 제공한다.
- 인증·권한·DB·shell 경계는 자동 수정하지 않고 BLOCKED로 남긴다.
- 수정 전후 targeted test와 전체 gate를 한 번씩만 실행한다.

### 5단계 — warning debt 제거

- 실제 위험이 있는 warning만 언어/runtime 또는 앱 코드에서 제거한다.
- 단순 스타일 경고는 `info`로 격하할지 사용자와 결정한다.
- warning 0을 목표로 삼기 전에 false-positive 비율을 측정한다.

## 다음 에이전트에게

- 먼저 이 문서와 `AGENTS.md`, `SPEC.airc`의 `hot`을 읽는다.
- 프로젝트 본체는 `/home/kim/kim/platform/freelang-front`다.
- `.flx` 기능은 FreeLang Front로 구현하고 Node.js는 build/dev 도구 경계로만 사용한다.
- dirty worktree의 6개 수정 파일은 이번 작업 결과다. 임의 reset 금지.
- 실제 실행 근거 없는 항목은 PASS로 보고하지 않는다.
- 커밋 전 `git diff --check`와 `npm run verify:internal`을 다시 실행한다.
- Forgejo push 후 local HEAD와 remote HEAD를 비교한다.

