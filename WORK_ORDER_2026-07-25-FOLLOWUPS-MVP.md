# 업무지시서 — Followups MVP (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 지시 — 도구/진단은 앱 만들다가 드러난 것만 좁게 고치고, 기본 축은 freelang-front로 실제 앱을 계속 쌓는다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> `/followups` — 오늘 처리할 다음 행동을 사람/결정/수동 메모와 연결해 보는 Island+SQLite 후속 행동 보드.

## 목적지

**Followups** 앱 1개를 freelang-front에 추가한다.

People CRM이 “누구와 다시 연락할지”를 만들었고, Decisions가 “무엇을 결정/회고할지”를 만들었다. 이번 앱은 그 다음 행동을 하루 단위로 모으는 얇은 실행 화면이다.

이번 작업의 부산은 다음이다.

- `pages/followups/{_db,api,index}.flx` + 홈 카드
- GET/POST JSON API + Island UI
- 오늘까지 / 예정 / 완료 / 보류 필터
- 수동 follow-up 추가, 완료 처리, 날짜 변경, 보류/재개, 삭제
- `FIX_2026-07-25-FOLLOWUPS-MVP.md`
- 빌드 통과 · PM2 `freelang-front`에서 curl/브라우저 실측

## 현재 기준선

착수 시점에 반드시 다시 재확인한다.

```bash
cd /home/kim/kim/skl/freelang-front
git status --short --branch
git log --oneline -5 --decorate
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-loop.js --dry
```

기준 기대:

- HEAD: `5ea6ba7` 이후 또는 그 이상
- build ok
- errors 0
- warnings 25
- `stdlibLoadOk true`
- `stdlibLsFnsCount 485`
- loop `converged true`, `remainingFixableCount 0`

dirty 제외 기준:

- `HANDOFF.airc`, `logs/`, `*.db`는 커밋하지 않는다.

## 디자인 기준

새 화면이므로 design-selector를 참고한다.

- 주 참조: `design-050` 회원 목록 — 상태 필터 탭 + 검색/목록 구조
- 보조 참조: `design-052` 체크인 — 오늘 처리된 항목을 최신순으로 쌓는 리스트 감각

freelang-front 기존 톤과 충돌하면 기존 People/Decisions/Prompts 패턴을 우선한다.

UI는 모바일 우선이다. 단, 데스크톱에서도 중앙 제한폭 리스트로 자연스럽게 보이게 한다.

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`만.
- FreeLang core / `runtime/bootstrap.js` / nginx / PM2 설정 / 타 skl-* 서비스 변경 금지.
- Node/Express/Python API 서버 신설 금지. 페이지·API는 전부 `.flx`.
- `/people`, `/decisions`, `/prompts`, `/contacts` 스키마 변경 금지.
- People/Decisions 데이터를 자동으로 migrate/import하지 않는다. 이번 MVP는 별도 DB다.
- `logs/`, `*.db`, `.env`, 브라우저 프로필, 임시 JSON 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- push/blog는 팀장 검수 후.

질문은 미완이 아니라 완성도다. 아래 범위가 실제 구현 중 애매하면 멈추고 질문한다.

## 제품 범위

### 데이터

신규 DB: `data/followups.db`

테이블 `followups`:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER PK | |
| `title` | TEXT NOT NULL | 할 일 한 줄 |
| `context` | TEXT | 짧은 맥락 |
| `due_date` | TEXT | `YYYY-MM-DD` 또는 `''` |
| `status` | TEXT | `open` \| `done` \| `snoozed` |
| `source_type` | TEXT | `manual` \| `people` \| `decision` |
| `source_id` | TEXT | 원본 id 문자열. MVP에서는 선택 입력 |
| `created_at` | TEXT | `datetime('now','localtime')` |
| `done_at` | TEXT | 완료 시각 또는 `''` |

하지 않는 것:

- People/Decisions DB를 직접 join해서 자동 생성
- 반복 일정/알림/푸시/캘린더
- 상세 페이지 `followups/[id].flx`
- 다중 담당자, 우선순위 점수, AI 추천

### API

라우트: `/followups/api`

GET 응답 함수명은 고유명으로 한다.

- 예: `(defn followups-payload [])`
- 전역 `(defn payload [])` 금지

GET 응답:

```json
{
  "items": [],
  "open_count": 0,
  "due_count": 0,
  "done_count": 0,
  "snoozed_count": 0,
  "today": "YYYY-MM-DD"
}
```

카운트:

- `due_count`: `status='open'`, `due_date != ''`, `due_date <= today`
- `open_count`: `status='open'`
- `done_count`: `status='done'`
- `snoozed_count`: `status='snoozed'`

POST `action`:

- `add`: `title` 필수, 나머지 선택
- `done`: `id`, `done_at=datetime('now','localtime')`, status done
- `reopen`: `id`, status open, `done_at=''`
- `snooze`: `id`, status snoozed
- `reschedule`: `id`, `due_date`
- `delete`: `id`

응답:

- 성공: `{"ok" true, ...followups-payload}`
- 실패: HTTP 400 + `{"ok" false, "error" "..."}`

SQLite row에 `obj-merge` 금지. 필요한 키는 `(get row "k")`로 명시 맵을 구성한다.

### UI

라우트: `/followups`

필수 요소:

1. 상단 카운트: 오늘까지 / 진행중 / 완료 / 보류
2. 필터 칩: 전체 · 오늘까지 · 진행중 · 완료 · 보류
3. 추가 폼: title / context / due_date / source_type / source_id
4. 행: title · due_date · source badge · status
5. 펼침 패널: context · 날짜 변경 · 완료/재개 · 보류 · 삭제
6. 모바일 터치 기준: 주요 버튼/행 `min-height >= 44px`, input `font-size: 16px`
7. 초기 로드는 `loaded` atom으로 1회만. 매 render마다 `fetch!` 금지.

정본 Island 마운트:

```clojure
(str "ISLAND_PLACEHOLDER" "ISLAND_SCRIPTS")
```

컴포넌트 심볼을 render에 직접 넣지 않는다.

## 구현 파일

예상 파일:

```text
pages/followups/_db.flx
pages/followups/api.flx
pages/followups/index.flx
pages/index.flx
FIX_2026-07-25-FOLLOWUPS-MVP.md
```

빌드 산출로 `.build-state.json`, `AGENTS.md`가 route manifest 변경을 반영하면 포함 가능하다.

## 검증 기준

### build/loop

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-loop.js --dry
```

기대:

- build ok
- errors 0
- warnings는 기준선 25에서 실장애 없는 신규 warning 증가가 없어야 한다
- `stdlibLoadOk true`
- `stdlibLsFnsCount 485`
- loop `converged true`
- `remainingFixableCount 0`

### HTTP

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/followups
curl -sS http://127.0.0.1:40860/followups/api
```

기대:

- `/followups` 200
- `/followups/api` keys: `items`, `open_count`, `due_count`, `done_count`, `snoozed_count`, `today`

### CRUD

오늘 날짜는 2026-07-25 기준으로 검증한다.

```bash
curl -sS -X POST http://127.0.0.1:40860/followups/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","title":"김테스트 연락","context":"People 후속","due_date":"2026-07-25","source_type":"people","source_id":"1"}'
```

기대:

- `ok true`
- `open_count` 증가
- `due_count` 증가

이후 `done`, `reopen`, `snooze`, `reschedule`, `delete`를 각각 1회 이상 실호출한다.

마지막에는 검증용 레코드가 남지 않게 삭제하거나, 남겼다면 보고에 명시한다.

### 브라우저

가능하면 Chrome headless/CDP 또는 실제 브라우저로 확인한다.

- `/followups` hard reload 후 API resource count가 1회 수준
- 추가 버튼/폼 표시
- 필터 칩 전환
- 행 펼침
- 완료 처리 후 카운트/행 상태 반영
- Error Overlay에 신규 오류 0

### 회귀

```bash
curl -sS -o /dev/null -w "people:%{http_code} decisions:%{http_code} prompts:%{http_code}\n" \
  http://127.0.0.1:40860/people \
  http://127.0.0.1:40860/decisions \
  http://127.0.0.1:40860/prompts
```

기대:

- 세 화면 모두 200
- `/people`은 데이터가 있으면 `.pe-row >= 1`
- `/decisions/api`, `/prompts/api` JSON shape 유지

## FIX 문서

`FIX_2026-07-25-FOLLOWUPS-MVP.md` 필수 섹션:

```md
# FIX — Followups MVP (2026-07-25)

## 범위
## 구현
## 검증
## 브라우저 확인
## 함정
## 남긴 것
```

함정에는 최소한 아래를 포함한다.

- `payload` 공용명 금지
- SQLite row `obj-merge` 금지
- Island `fetch!` 1회 로드
- `length` 비교는 현재 compiler 수정 후 기준
- Error Overlay 신규 오류 여부

## 보고 양식

보고는 완료 단정 대신 아래 형식으로 한다.

```md
목적지 한 줄:

기준선:
- HEAD:
- build:
- warnings:

구현:
- 파일:
- DB:
- API:
- UI:

검증:
- build/loop:
- curl:
- CRUD:
- browser/CDP:
- 회귀:

남긴 것:
- dirty:
- 검증 데이터:
- 보류 카운트:

판단:
- People/Decisions와 자동 통합하지 않은 이유:
- 앱 만들며 발견한 언어/도구 이슈:
```
