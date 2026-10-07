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
| 1 | 언어 코어·진단 | `.flx` 문법, 오류 코드, `--json`, manifest, AI gate | PASS — build/typecheck/AI gate, errors 0 |
| 2 | 파일 라우팅 | 정적·동적·중첩·404·redirect·충돌 판정 | PASS — clean artifact 144 routes + 404 |
| 3 | SSR·레이아웃 | layout/landing, metadata, loading/error, 공통 셸 | PASS 9/10 — 대표 SSR 5면 200, 빠른 SPA 이동 취소 로그 1건 |
| 4 | API·데이터 | CRUD, validation, SQLite/AFJ, 표준 오류 응답 | PASS 9/10 — API matrix, AFJ-DB auth/perf, CRUD evidence |
| 5 | Island UI | atom, fetch, form, filter, expand, optimistic update | PASS — Island 11/11, 경계/JS 검사 PASS |
| 6 | AI 개발 인터페이스 | manifest, diagnostics, headless test, 자동수정 루프 | PASS — AI gate + 3개 진단 회귀 PASS |
| 7 | 컴포넌트·스타일 | `_ui`, 재사용 컴포넌트, CSS DSL, theme, 접근성 | PASS — UI contract 0 violations + 브라우저 DOM |
| 8 | 개발 경험·내부 운영 | HMR, logs, overlay, start/review, 내부 deploy/rollback | PASS — clean deploy/smoke/rollback-plan PASS |
| 9 | 성능·보안 | cache, session, CSRF, rate limit, performance regression | PASS 7/10 — auth/perf PASS, SSE 501은 감점 |
| 10 | 실제 앱 검증 | People/Market/Flow/Dashboard 기능 매트릭스와 browser evidence | PASS 9/10 — HTTP matrix + 브라우저 DOM, console limitation 1건 |

## 최종 점수

```text
stage_scores = [10, 10, 9, 9, 10, 10, 10, 10, 7, 9]
NEXT90_SCORE = 94 / 100
NEXT90 = PASS
판정: 90점 이상이며 핵심 영역 6점 미만 없음
기준 HEAD: 1460447 (clean artifact 통합 gate에서 전 항목 PASS)
```

점수는 상용 운영 준비도가 아니라 이 문서의 Next-90 범위(SSR·API·Island·AI
개발 경험)의 능력 점수다. 외부 공개, PM2 이름 추측, 상용 release는 범위 밖이다.

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
  internal_smoke=PASS (5 pages 200 + canonical /api/hello JSON 200)
  internal_deploy=BLOCKED (dirty-worktree)
  perf_afldb=PASS (실제 PM2 AFJ-DB + Front, N=3/WARM=1; clips API 31.2ms, AFJ-DB stats 1.5ms, verify 25.4ms, CRUD add-delete 85.5ms)
  browser_matrix=PASS (People/Market/Flow/Dashboard headings and Island surfaces)
  dashboard_timestamp=PASS (numeric timestamp rendered as local time)
  sse=KNOWN_LIMITATION (metrics/alerts endpoint returns 501; UI uses polling fallback)
  afldb_auth_mock=PASS (read/write Bearer boundary + 4xx failure handling)
  next90_app_matrix=PASS (People/Market/Flow/Dashboard 200 + 3 API items contracts + 404)
  fl_tools_check=PASS (official FX runner recognizes `&` rest; Front type-check 0 errors)
  next90_release_gate=PASS (clean artifact; build/contract/typecheck/regression/HTTP all PASS)
```

이 수치는 위의 10단계 점수표와 clean artifact gate 결과를 합친 최종 판정이다.
사용자 정본의 dirty 변경은 별도 보존했으며, 그 상태에서의 deploy 명령은 계속
정책상 BLOCKED다. clean artifact에서만 내부 deploy gate를 PASS로 판정한다.

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
`items` 배열 계약, 알 수 없는 경로의 404를 하나의 런타임 fixture로
검사한다. 브라우저 상호작용 증거와 서버 HTTP fixture는 서로 대체하지 않는다.

`fl-tools check`의 첫 원인은 FreeLang 코어의 `&` rest marker 미인식이었고,
공식 FX runner에 이를 반영했다. 이어 Front의 `h`를 실제 사용 계약에 맞는
`[tag attrs & content]`로 고치고, 텍스트를 넘기던 `h!` 버튼 4곳을 `h`로
교정했으며, `router.fl`의 지원되지 않는 키워드 접근도 `get`으로 바꿨다.
그 결과 공식 runner 기준 `_app.fl` 포함 전체 검사에서 **0 type-check error**,
`FREELANG_CHECK=PASS`를 재현했다. 코어와 Front의 변경은 각각 별도 커밋이며
기존 사용자 dirty 변경은 stage/commit하지 않았다.

## 다음 작업

남은 blocker는 없다. 다음 개선 후보는 SSE capability를 Front runtime에 흡수하고,
View Transition 취소 로그를 줄이는 것이다. 두 항목은 현재 94점 판정을 뒤집지는
않지만, 구현·실행·회귀 증거를 확보하기 전에는 PASS로 올리지 않는다.
