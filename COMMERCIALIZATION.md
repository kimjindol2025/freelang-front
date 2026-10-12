# FreeLang Front 상용화 기준

이 문서는 `blog-automation` 같은 소비자 앱의 계획이 아니라, FreeLang Front
언어·컴파일러·브라우저 bridge·runtime·검수 도구 본체의 상용화 기준이다.

## 목표

Next.js를 기능 비교 기준으로 삼되, 제품 소스의 정본은 `.flx`로 유지한다.
JS는 컴파일러가 생성하는 브라우저 bridge와 개발 도구 경계에만 둔다.

## 단계와 통과 조건

| 단계 | 범위 | 통과 조건 | 현재 |
|---|---|---|---|
| 0 | 정본 고정 | `.flx`·runtime·adapter 경계 문서화 | PASS |
| 1 | SSR/API/라우팅 | 정적·동적 route, JSON API, 오류 페이지 | PASS |
| 2 | Island 언어 | atom/store, fetch, props, headless 실행 | PASS |
| 3 | 개발 경험 | HMR, 실시간 진단, `.flx` 원본 위치 매핑 | PASS |
| 4 | 운영 기능 | DB/adapter, SSE, metrics, CSP-safe SPA bridge | PASS |
| 5 | AI-native 계약 | manifest, language contract, source context, typecheck | PASS |
| 6 | 브라우저 primitive | copy/date/timer/fetch/event-stream 계약과 회귀 | PASS · event-stream 추가 |
| 7 | clean release | dirty 변경 분리, clean clone, artifact hash, rollback | BLOCKED · 기존 사용자 변경 보존 중 |
| 8 | 내부 1.0 | 실제 HTTP·SSE·SPA·브라우저 검수와 release artifact | 부분 PASS · clean release 전 |

## 이번 변경의 증거

- `event-stream!`을 browser-bridge adapter 계약에 등록했다.
- `island-runner.js`에 연결 상태·메시지 callback headless mock을 추가했다.
- `pages/examples/37-event-stream-contract.flx`를 언어 예제로 추가했다.
- `scripts/front-language-conformance.js`에 event-stream runtime 회귀를 추가했다.
- Front build: 153 routes, 0 errors, 0 warnings.
- language contract: PASS.
- conformance: PASS.
- Next90 internal gate: 정적·HTTP·SSE·SPA 항목 PASS.
- 브라우저 계약: Chrome에서 People → Market → 등록 폼 상호작용 PASS.
- 서버 포트: `PORT` 환경변수로 격리 실행 가능하며 기본값은 40860이다.
- 다중 인스턴스: 두 개의 실제 FreeLang 런타임에서 API·SSR·Island·event-stream
  예제 라우트를 동시에 HTTP 검증한다.
- 성능 계약: API p95 50ms, SSR p95 120ms, 20개 동시 요청 p95 400ms,
  API 200회 연속 요청 오류 0건, 운영 Node 힙 256MB 상한, 런타임 RSS 512MB
  미만을 실제 실행으로 검증한다.

`npm run multi:contract`는 하네스가 만든 자식 프로세스만 종료하며, 기존 서버는
건드리지 않는다.

## 현재 BLOCKED와 처리 원칙

현재 Git worktree에는 다른 사용자/에이전트가 진행한 Crew, HMR, 진단, 문서 변경이
남아 있다. 그 변경을 자동 stage·commit·삭제하지 않는다. 따라서 release gate의
`clean-worktree`는 BLOCKED로 유지한다.

다음 릴리즈 순서는 다음과 같다.

1. 현재 dirty 변경을 파일별 소유자와 검수 결과로 분류한다.
2. 사용자 승인 후 하나의 Front 본체 커밋으로 정리한다.
3. clean clone build와 artifact hash를 확인한다.
4. 내부 1.0 tag/release manifest를 기록한다.
5. 이후에만 push/deploy를 수행한다.

이 문서의 PASS는 실제 명령 실행 증거가 있는 항목만 의미한다. 앱 하나가 동작하는
것만으로 Front 언어 상용화 완료로 판정하지 않는다.
