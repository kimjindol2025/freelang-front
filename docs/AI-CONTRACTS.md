# FreeLang AI Contract v1

이 문서는 FreeLang 파일이 AI에게 즉시 전달해야 하는 계약 메타를 정의한다.

## 목적

- 파일이 무엇인지
- 무엇을 읽고 쓰는지
- 어떤 상태가 정상인지
- 마지막으로 검증된 기준이 무엇인지
- AI가 어떤 공식 패턴을 선택해야 하는지

## 권장 헤더 형식

```text
; @contract
; route: /roadmap
; purpose: roadmap-dashboard
; type: page
; pattern: UI_PAGE
; routes:
;   read: GET /check
;   read: GET /examples
; state:
;   source: server
;   mutable: false
; requires:
;   auth: none
; checks:
;   syntax: PASS
;   route: PASS
;   schema: PASS
;   smoke: PASS
; last_verified:
;   commit: f0e4a02
; @endcontract
```

## 필드 의미

- `route`: 이 파일의 대표 라우트
- `purpose`: AI용 한 줄 목적
- `type`: `page` / `api` / `worker` / `db` 중 하나
- `pattern`: 공식 문제군 패턴명, 예: `UI_PAGE`, `API_READ`, `API_MUTATION`, `DB_ENTITY`, `WORKER`
- `routes.read` / `routes.write`: 관련 실제 HTTP 경로
- `state.source`: `server` 또는 `client`
- `state.mutable`: 현재 상태가 변하는지 여부
- `requires.auth`: 필요한 인증 수준
- `checks.*`: 빌드/라우트/스키마/스모크 판정
- `last_verified.commit`: 빌드·라우트·스키마·스모크를 마지막으로 확인한 기준 커밋. 이후 소스 변경 또는 새 검증 전에는 `in_progress`로 표시한다.

## 판정 규칙

- `checks`가 모두 `PASS`이고 `last_verified.commit`이 현재 HEAD와 같으면 `complete`
- 일부만 충족하거나 커밋이 다르면 `in_progress`
- 계약 블록이 없으면 `missing`
- 생성된 .build-state.json의 repoCommit과 계약의 검증 커밋이 다르면 /roadmap에서 stale 검증으로 표시한다.

## 문제군 패턴

- `UI_PAGE`: 사용자 화면, 대시보드, 선언문, 상태 페이지
- `API_READ`: 읽기 전용 JSON/API
- `API_MUTATION`: 저장/수정/배치 쓰기 API
- `DB_ENTITY`: DB 엔티티/레코드 중심 작업
- `WORKER`: 비동기 작업/백그라운드 처리

## 브라우저 탭 검증

브라우저 기반 프론트 검증이 필요한 파일은 다음 정보를 추가로 기록할 수 있다.

- `browser.target`: `tab` / `url` / `profile`
- `browser.tab_id`: 사용자가 지정한 감시 탭 식별자
- `browser.url`: 감시 대상 URL
- `checks.browser.load`
- `checks.browser.console`
- `checks.browser.network`
- `checks.browser.dom`
- `checks.browser.interactions`
- `checks.browser.screenshot`
- `checks.browser.result`

판정 규칙:

- `tab_id`가 비어 있으면 브라우저 검증 계약으로 보지 않는다.
- `console_errors`, `network_errors`, `dom`, `interactions`, `screenshot` 중 하나라도 실패하면 `in_progress` 또는 `missing`으로 둔다.
- 사용자가 지정한 단일 탭만 감시하고, 다른 탭의 로그는 제외한다.

## 현재 운영 원칙

- 인간은 의도와 승인에 집중한다.
- AI는 생성, 검증, 수정, 운영 루프를 수행한다.
- 계약은 README의 장문 설명보다 우선한다.
- 상태 판정은 문서가 아니라 빌드 산출물과 `/~ai` 조회로 확인한다.
