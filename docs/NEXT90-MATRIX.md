# Front Next-90 10단계 매트릭스

목표는 Next.js의 모든 내부 구현을 복제하는 것이 아니다. FreeLang Front로
콘텐츠 앱·관리자 대시보드·SaaS 화면을 만들 때 개발자가 체감하는 핵심 능력의
90%를, SSR + API + Island라는 Front 고유 구조로 제공하는 것이다.

## 판정 규칙

- 대상 기능은 10개 영역, 각 영역 10점으로 총 100점이다.
- 영역 점수는 `구현 40% + 실제 실행 30% + 회귀 검증 20% + AI 계약 10%`로 계산한다.
- 90점 이상이면서 어떤 핵심 영역도 6점 미만이면 `NEXT90=PASS`다.
- 문서만 있는 기능, 실행하지 않은 기능, 브라우저 근거가 없는 화면 주장은 PASS가 아니다.
- Next 전용 생태계 기능(React Server Components 내부 동작, npm 생태계 호환, Vercel 전용 기능)은 범위 밖이다.

## 10단계

| 단계 | 영역 | 완료 기준 | 현재 상태 |
|---:|---|---|---|
| 1 | 언어 코어·진단 | `.flx` 문법, 오류 코드, `--json`, manifest, AI gate | 진행 중 — AI gate PASS, errors 0, warnings 30 |
| 2 | 파일 라우팅 | 정적·동적·중첩·404·redirect·충돌 판정 | 진행 중 — 145 route build 확인 |
| 3 | SSR·레이아웃 | layout/landing, metadata, loading/error, 공통 셸 | 진행 중 |
| 4 | API·데이터 | CRUD, validation, SQLite/AFJ, 표준 오류 응답 | 진행 중 |
| 5 | Island UI | atom, fetch, form, filter, expand, optimistic update | 진행 중 — 기존 island 테스트 존재 |
| 6 | AI 개발 인터페이스 | manifest, diagnostics, headless test, 자동수정 루프 | 부분 완료 — AI contract gate 추가 |
| 7 | 컴포넌트·스타일 | `_ui`, 재사용 컴포넌트, CSS DSL, theme, 접근성 | 진행 중 — UI contract PASS, 예제 33 추가 |
| 8 | 개발 경험·내부 운영 | HMR, logs, overlay, start/review, 내부 deploy/rollback | 부분 완료 — 내부 계약·smoke PASS, clean deploy는 dirty 차단 |
| 9 | 성능·보안 | cache, session, CSRF, rate limit, performance regression | 진행 중 |
| 10 | 실제 앱 검증 | People/Market/Flow/Dashboard 기능 매트릭스와 browser evidence | 부분 완료 — HTTP 앱 매트릭스·Decision smoke/e2e PASS, 브라우저 증거는 별도 |

## 순서

```text
1 코어 진단
→ 2 라우팅
→ 3 SSR/layout
→ 4 API/DB
→ 5 Island
→ 6 AI interface
→ 7 component/style
→ 8 DX/internal operation
→ 9 performance/security
→ 10 real-app score
```

각 단계는 `기능 구현 → 실제 실행 → 회귀 테스트 → AI 계약 갱신 → 점수 기록`을
한 사이클로 한다. 다음 단계로 넘어갈 때 실패를 숨기지 않고 blocker로 남긴다.

## 현재 증거

```text
node scripts/ai-contract-gate.js --json
  schema=fl-ai-gate/1
  pass=true
  errors=0
  warnings=30
  routes=145
  ui_contract=PASS
  decision_api_smoke=PASS
  decision_api_e2e=PASS
  http_pages=/people,/market,/flow,/dashboard,/examples/33-ui-components => 200
  ui_example_marker=PASS
  browser_ui_matrix=PASS (5 rows rendered with accessible text)
  internal_smoke=PASS (5 pages 200 + POST validation 400)
  internal_deploy=BLOCKED (dirty-worktree)
  perf_afldb=PASS (실제 PM2 AFJ-DB + Front, N=3/WARM=1; clips API 31.2ms, AFJ-DB stats 1.5ms, verify 25.4ms, CRUD add-delete 85.5ms)
  browser_matrix=PASS (People/Market/Flow/Dashboard headings and Island surfaces)
  dashboard_timestamp=PASS (numeric timestamp rendered as local time)
  sse=KNOWN_LIMITATION (metrics/alerts endpoint returns 501; UI uses polling fallback)
  afldb_auth_mock=PASS (read/write Bearer boundary + 4xx failure handling)
  next90_app_matrix=PASS (People/Market/Flow/Dashboard 200 + 3 API items contracts + 404)
```

이 수치는 전체 Next-90 점수가 아니다. 현재 AI 친화적 빌드·manifest 기반과
컴포넌트·API 경계가
검증됐다는 뜻이며, 최종 90%는 10단계 실제 앱 매트릭스가 닫힐 때 판정한다.

## 검수에서 발견한 회귀와 조치

예제 33을 처음 실제 HTTP로 호출했을 때 `ui-table`과 `ui-stat`에 존재하지 않는
`type` 내장함수가 남아 있어 500이 발생했다. 런타임에 실제 존재하는 문자열 변환과
맵 행 계약으로 수정한 뒤 빌드, UI 계약 게이트, 전체 대표 화면 HTTP 검수를 다시
실행했고 모두 PASS/200으로 확인했다. 이 사례는 문법·정적 검사만으로는 충분하지
않고 새 화면을 반드시 실제 서버에서 호출해야 한다는 검수 규칙으로 남긴다.

이후 브라우저 접근성 검수에서 셀 값이 `null`로 보이는 추가 회귀를 발견했다.
익명 함수 경계를 named helper로 바꾸고 실제 `get` 인덱스 계약을 사용한 뒤,
Chrome 접근성 트리에서 5개 행의 컴포넌트·그룹·상태 텍스트를 확인했다.

성능 단계에서는 기존 측정기가 AFJ-DB의 이전 비인증 경로(`/stats`, `/verify`)를
사용하고 있음을 발견했다. 측정기를 현재 `/v1/*` Bearer 계약으로 갱신하고,
실제 PM2 환경의 `AFLDB_ADMIN_KEY`를 주입해 N=3/WARM=1 측정을 완료했다.
측정값은 Front clips API 중앙값 31.2ms, AFJ-DB stats 1.5ms, verify 25.4ms,
CRUD add-delete 왕복 85.5ms였다. 존재하지 않는 KV 키의 404는 저장소 장애가
아니므로 라우팅·인증 지연을 측정하는 허용 상태로 분리 기록한다.

대표 앱 브라우저 검수에서는 Dashboard의 숫자 timestamp를 문자열로 `Date`에
넘겨 `Invalid Date`가 되던 문제를 발견했다. `Number(timestamp)` 변환과 SSE
미지원 시 polling fallback 표시를 추가하고 실제 브라우저에서 시간 표시를
확인했다. SSE 자체는 현재 런타임 계약상 501이므로 PASS로 둔갑시키지 않는다.

AFJ-DB 연동은 실제 정본의 역할별 Bearer 계약을 확인한 뒤 `_afldb.flx`에
`AFLDB_URL`·read/write 키 주입과 4xx/error 전파를 추가했다. 인증 mock에서
상태·get·put을 실제 요청으로 확인했고, PM2 AFJ-DB를 대상으로 성능 수치도
확보했다.

10단계 대표 앱은 `tests/next90-app-matrix.js`로 실제 실행 경계를 고정했다.
네 페이지의 200 응답·핵심 화면 표식, People/Market/Followups API의
`ok=true`·`items` 배열, 알 수 없는 경로의 404를 하나의 런타임 fixture로
검사한다. 브라우저 상호작용 증거와 서버 HTTP fixture는 서로 대체하지 않는다.

## 다음 작업

7단계에서 `_ui.flx`의 실제 재사용 컴포넌트 계약을 고정하고, 10단계에서 사용할
People·Market·Flow·Dashboard의 공통 화면 시나리오를 먼저 테스트 fixture로 만든다.
