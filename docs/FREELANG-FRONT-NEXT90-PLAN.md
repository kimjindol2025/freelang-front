# FreeLang Front Next.js 90% 목표·10단계 실행 계획

> 이 문서는 FreeLang Front의 단일 진행 기준이다. 기능을 발견할 때마다
> 임시로 추가하지 않고, 아래 단계와 통과 기준을 순서대로 충족한다.

## 최종 목표

FreeLang Front를 Next.js의 기능·개발 경험·안정성을 100점 기준선으로 삼아
90점 이상 수준까지 발전시킨다. 1차 사용처는 외부 상용 공개가 아니라 이 서버의
AI 개발용 내부 플랫폼이며, 내부에서 반복 사용 가능한 신뢰성을 먼저 확보한다.

FreeLang Front의 정체성은 유지한다.

- 정본 소스는 `.flx`다.
- SSR·API·라우팅·Island·상태는 FreeLang 문법으로 작성한다.
- JS는 선언된 브라우저 bridge/runtime 경계에만 둔다.
- FreeLangScript를 build·check·test·review·release 자동화의 기준으로 삼는다.
- AI가 읽고 고치기 쉬운 명시적 계약·진단·재현 명령을 우선한다.

## 90점 판정표

| 영역 | 배점 | 90점 기준 |
|---|---:|---|
| 언어·컴파일 계약 | 15 | 결정적 빌드, 구조화 진단, source map |
| SSR·라우팅 | 15 | 파일 라우팅·동적 라우트·layout·SEO가 안정적으로 동작 |
| API·데이터 어댑터 | 10 | JSON·검증·오류·provider 교체 계약 |
| 컴포넌트·Island·상태 | 15 | props·event·atom/store·재렌더 의미론 고정 |
| HMR/Fast Refresh | 10 | CSS reload·soft refresh·상태 보존·실패 fallback |
| 타입·DX·진단 | 10 | 타입/린트/오류 위치/AI용 수정 힌트 |
| 패키지·문서·예제 | 5 | scaffold·기본 템플릿·일관된 공식 예제 |
| 테스트·배포 | 10 | targeted test·회귀·clean clone·artifact·rollback |
| 운영·보안·성능 | 10 | 권한·metrics·SSRF/비밀 경계·성능 기준 |
| **합계** | **100** | **90점 이상, critical BLOCKED 없음** |

## 10단계 계획

| 단계 | 목표 | 핵심 산출물 | 통과 기준 | 현재 |
|---:|---|---|---|---|
| 1 | 언어 정본·경계 고정 | `front-language.contract.json`, adapter contract | `.flx` 정본, JS 경계, adapter inventory PASS | **완료** |
| 2 | 컴파일러·진단 안정화 | `fl-diagnostics/1`, syntax/type 진단, source line mapping | 같은 입력의 결정적 결과와 파일·라인·힌트 재현 | **완료** |
| 3 | SSR·파일 라우팅 표준화 | layout/page/API/동적 라우트 계약 | 149 routes build, SSR·SEO·404·POST route PASS | **기본 완료** |
| 4 | API·데이터 provider 표준화 | `front-db-*`, `front-http-*`, `front-collection-*` | SQLite·AFJ-DB95·memory provider 계약, 오류 보존 | **진행 중** |
| 5 | 컴포넌트·Island·상태 표준화 | props/event/atom/store/fetch 표준 | headless + 실제 HTTP에서 재렌더·상태 보존 PASS | **진행 중** |
| 6 | HMR/Fast Refresh 상용화 | L1 reload, L2 CSS, L3 soft refresh + build-error gate | 상태·폼 보존, CSS 무재시작, 오류 source:line:column 표시, 실패 시 full reload fallback | **기본 계약 PASS** |
| 7 | 타입·DX·AI 작업 흐름 | typecheck/lint/diagnostic/fix 명령 | AI가 오류 위치·원인·수정 후보를 한 번에 얻음 | **진행 중** |
| 8 | 패키지·문서·예제 생태계 | scaffold, templates, examples, migration guide | 새 프로젝트를 문서·CLI만으로 생성·실행 | **예정** |
| 9 | 테스트·배포·운영 신뢰성 | release gate, clean clone, artifact, metrics, rollback | targeted → regression → release gate 전부 PASS | **내부 배포 PASS** |
| 10 | Next90 인증·독립 릴리즈 | Next90 scorecard, benchmark report, v1 release | 90점 이상, critical BLOCKED 없음, 운영 리허설 PASS | **진행 중** |

## 작업 규칙

각 단계는 다음 순서를 지킨다.

```text
계약 정의 → 최소 구현 → targeted test → 회귀 test → 전체 release gate → 문서 기록
```

통과하지 못한 단계는 다음 단계로 넘기지 않는다. 단, 실제 외부 인증·서버·권한이
필요한 경우에는 `BLOCKED` 원인과 재현 명령을 문서에 남기고, 가능한 mock/test
provider로 언어 계약 자체는 계속 검증한다.

## 진행 통제 규칙

각 단계는 한 번에 다음 순서로만 진행한다.

```text
단계 계약 확인
→ 최소 구현
→ 해당 단계 targeted test
→ 전체 regression/release gate
→ 문서와 실패 기록 갱신
→ 커밋
→ 다음 단계
```

- 새 결함을 발견해도 현재 단계의 범위를 먼저 닫는다.
- 이미 통과한 검사는 반복하지 않고, 변경 영향이 있는 targeted test만 먼저 실행한다.
- 실제 실행 증거가 없는 항목은 PASS가 아니라 `BLOCKED` 또는 `UNRESOLVED`다.
- 생성 상태 파일과 사용자가 진행 중인 변경은 자동 커밋하지 않는다.
- JS는 Front 언어를 대체하지 않고, 선언된 브라우저 bridge와 검증 도구 경계에만 둔다.

## 현재 증거와 기준점

기준 커밋은 `1c6d796`이며, AI 진단 기능과 실시간 진단 계약이 커밋·push된
상태다.

- `npm run front:context`: `.flx` 원본 위치·주변 코드·빌드 커밋·hash 반환
- `/~ai/source?format=json`: 브라우저 오류 위치의 구조화 문맥 반환
- 오류 오버레이 대표 파일·줄과 call stack 클릭 → `/~ai/source` 원본 뷰어 이동
- `/~ai/diagnostics`: 실시간 build-error/HMR 상태와 마지막 정상 빌드 보존
- HMR 계약과 전체 release gate에 source-context 검사 연결
- `docs/TYPE-DIAGNOSTICS.md`에 AI 입력 계약 기록

최근 검증 결과:

- Front build, 언어 conformance, typecheck, AI contract, HMR, 회귀: PASS
- 내부 HTTP·SSE·SPA 검증: PASS
- 정적 게이트의 HTTP 항목: `BASE_URL`이 없으면 BLOCKED
- `clean-worktree`: 계획된 미커밋 변경이 있으므로 BLOCKED
- 내부 배포: `1c6d796` PM2 반영·smoke·SSE·SPA·artifact hash PASS

## 현재 다음 작업

1. **HMR 상태 보존 정교화** — CSS·페이지·Island 변경별 refresh 범위와 폼/상태 보존 검증
2. **컴포넌트·상태 표준화** — props/event/atom/store의 단일 작성 규칙 확정
3. **provider·API 오류 계약** — 실제 DB·HTTP 경계와 오류 보존 방식 고정
4. **패키지·예제·scaffold** — AI가 새 프로젝트를 계약만으로 생성하도록 정리
5. **clean clone·artifact·rollback 운영 리허설** — 실제 rollback 적용은 별도 승인 후 실행
6. **Next90 점수표 재평가** — critical BLOCKED가 없을 때만 10단계 완료 판정

이 문서는 상용 완성 선언이 아니다. 단계 10의 실제 증거가 모일 때까지 목표는
활성 상태로 유지한다.
