# FreeLang Front 표준 라이브러리 기준

FreeLang Front 생태계는 패키지 숫자보다 AI가 반복해서 쓰는 기능의 계약 안정성을
우선한다. AI가 기능을 고르는 정본은 [`ai-capabilities.json`](../ai-capabilities.json),
라이브러리 파일 목록은 [`stdlib/libraries.json`](../stdlib/libraries.json)이다.

## 지금 제공하는 것

| 라이브러리 | 정본 | 상태 | 용도 |
|---|---|---|---|
| `flx-ui` | `pages/_ui.flx` | stable | 버튼·폼·레이아웃·피드백·테이블 |
| `flx-auth` | `pages/_auth.flx` | stable-internal | 세션·로그인·라우트 가드 |
| `flx-data` | `_db/_afldb/_afldb_coll` | stable | SQLite·AFJ-DB95·provider 경계 |
| `flx-test` | `stdlib/flx-test.flx` | stable | AI가 읽는 테스트 결과 계약 |
| `flx-schema` | `stdlib/flx-schema.flx` | stable | 필수 입력·payload 계약 |
| `flx-fixture` | `stdlib/flx-fixture.flx` | stable | 결정적 in-memory 재현 데이터 |

`flx-http`와 `flx-chart`는 이미 내부 헬퍼로 사용 중이며, 별도 중복 패키지는
만들지 않고 현재 정본을 유지한다.

## 보류하는 것

`flx-email`, `flx-payment`, `flx-i18n`은 현재 제품 사용량이나 provider 계약이
충분하지 않다. `flx-storage`는 존재하지만 presigned URL의 완전한 서명 계약이
굳기 전까지 stable로 승격하지 않는다.

보류는 실패가 아니라 범위 통제다. 실제 앱에서 두 개 이상의 사용 사례와 provider
회귀가 생기면 별도 계약·문서·실행 테스트를 만든다.

## 검증

```bash
npm run libraries:contract
```

이 검사는 필수 정본 파일 존재, `flx-test` 실제 FreeLang 실행, 보류 목록을
구조화 JSON으로 확인한다.

AI capability 선택 계약은 다음 명령으로 검증한다.

```bash
npm run ai:capabilities
```
