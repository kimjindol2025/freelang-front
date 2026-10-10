# FreeLang Front Next.js 90% 목표·10단계 실행 계획

## 최종 목표

FreeLang Front를 Next.js의 기능·개발 경험·안정성을 100점 기준선으로 삼아
90점 이상 수준까지 발전시킨다.

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
| 2 | 컴파일러·진단 안정화 | `fl-diagnostics/1`, syntax/type 진단, source line mapping | 같은 입력의 결정적 결과와 파일·라인·힌트 재현 | **진행 완료** |
| 3 | SSR·파일 라우팅 표준화 | layout/page/API/동적 라우트 계약 | 149 routes build, SSR·SEO·404·POST route PASS | **진행 중** |
| 4 | API·데이터 provider 표준화 | `front-db-*`, `front-http-*`, `front-collection-*` | SQLite·AFJ-DB95·memory provider 계약, 오류 보존 | **진행 중** |
| 5 | 컴포넌트·Island·상태 표준화 | props/event/atom/store/fetch 표준 | headless + 실제 HTTP에서 재렌더·상태 보존 PASS | **진행 중** |
| 6 | HMR/Fast Refresh 상용화 | L1 reload, L2 CSS, L3 soft refresh + build-error gate | 상태·폼 보존, CSS 무재시작, 오류 source:line:column 표시, 실패 시 full reload fallback | **계약 PASS** |
| 7 | 타입·DX·AI 작업 흐름 | typecheck/lint/diagnostic/fix 명령 | AI가 오류 위치·원인·수정 후보를 한 번에 얻음 | **부분 완료** |
| 8 | 패키지·문서·예제 생태계 | scaffold, templates, examples, migration guide | 새 프로젝트를 문서·CLI만으로 생성·실행 | **예정** |
| 9 | 테스트·배포·운영 신뢰성 | release gate, clean clone, artifact, metrics, rollback | targeted → regression → release gate 전부 PASS | **부분 완료** |
| 10 | Next90 인증·독립 릴리즈 | Next90 scorecard, benchmark report, v1 release | 90점 이상, critical BLOCKED 없음, 운영 리허설 PASS | **예정** |

## 작업 규칙

각 단계는 다음 순서를 지킨다.

```text
계약 정의 → 최소 구현 → targeted test → 회귀 test → 전체 release gate → 문서 기록
```

통과하지 못한 단계는 다음 단계로 넘기지 않는다. 단, 실제 외부 인증·서버·권한이
필요한 경우에는 `BLOCKED` 원인과 재현 명령을 문서에 남기고, 가능한 mock/test
provider로 언어 계약 자체는 계속 검증한다.

## 현재 다음 작업

1. HMR 3단계 + build-error/source-location 자동 계약 테스트 — `npm run hmr:contract` PASS
2. `front-server-*` 응답 표면과 API 오류 계약 정리
3. 타입·진단 점수표와 AI 수정 명령 정리
4. scaffold·공식 예제·패키지 manifest 설계

이 문서는 상용 완성 선언이 아니다. 단계 10의 실제 증거가 모일 때까지 목표는
활성 상태로 유지한다.
