# 업무지시서 — Followups Source Actions (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 방향 — 도구/진단을 먼저 파지 말고, freelang-front로 실제 앱 흐름을 계속 쌓는다. Followups MVP가 들어갔으니 People/Decisions와의 얇은 제품 연결을 다음 단위로 본다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> People/Decisions의 열린 행에서 명시적으로 Followups 항목을 만들 수 있게 하되, 자동 import나 DB join은 하지 않는다.

질문은 미완이 아니라 완성도다. 아래 범위에서 애매하면 멈추고 질문한다.

## 목적지

Followups가 독립 앱으로만 존재하면 사용자가 매번 수동으로 출처를 적어야 한다. 이번 작업은 `/people`과 `/decisions`의 행 펼침 패널에 “후속 만들기” 행동을 추가해, 사용자가 보고 있는 사람/결정에서 바로 `/followups/api`로 다음 행동을 생성하게 한다.

끝 상태:

- `/people` 행 펼침 패널에서 Followups 항목을 만들 수 있다.
- `/decisions` 행 펼침 패널에서 Followups 항목을 만들 수 있다.
- 생성된 Followups row는 `source_type`과 `source_id`를 가진다.
- Followups DB는 여전히 별도 DB다. People/Decisions DB를 직접 join/import하지 않는다.
- 이번에 드러난 실장애가 아니면 진단/도구 정리는 하지 않는다.

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

- HEAD: `3ed3598` 이후 또는 그 이상
- origin/master 동기 또는 이번 작업만 ahead
- build ok
- errors 0
- warnings 25
- `stdlibLoadOk true`
- `stdlibLsFnsCount 485`
- loop `converged true`, `remainingFixableCount 0`

dirty 제외 기준:

- `HANDOFF.airc`, `logs/`, runtime `*.db`는 커밋하지 않는다.

## 제품 범위

### People → Followups

위치:

- `/people`의 행 펼침 패널.

행동:

- 버튼/액션 이름은 사용자가 바로 이해할 수 있게 한다. 예: `후속 만들기`.
- 클릭 시 `POST /followups/api` `action=add`.

생성 규칙:

| Followups 필드 | 값 |
|---|---|
| `title` | `연락: {people.name}` |
| `context` | People의 `tag`, `context`, `next_touch` 중 비어 있지 않은 값을 짧게 조합 |
| `due_date` | `people.next_touch`가 있으면 그 값, 없으면 Followups API의 `today` 또는 빈 값 중 더 자연스러운 쪽 |
| `source_type` | `people` |
| `source_id` | People row `id` 문자열 |

완료 후:

- People 목록 전체를 다시 불러오는 방식이어도 된다.
- 더 낫다면 People data는 유지하고 패널 안에 짧은 성공 상태만 보여도 된다.
- 실패 시 Error Overlay만 의존하지 말고 화면 안에 짧은 오류를 보여라.

### Decisions → Followups

위치:

- `/decisions`의 행 펼침 패널.

행동:

- 버튼/액션 이름은 사용자가 바로 이해할 수 있게 한다. 예: `후속 만들기`.
- 클릭 시 `POST /followups/api` `action=add`.

생성 규칙:

| Followups 필드 | 값 |
|---|---|
| `title` | `후속: {decision.title}` |
| `context` | decision의 `status`, `chosen`, `outcome`, `context` 중 비어 있지 않은 값을 짧게 조합 |
| `due_date` | 오늘 날짜 |
| `source_type` | `decision` |
| `source_id` | Decision row `id` 문자열 |

완료 후:

- Decisions 목록 전체를 다시 불러오는 방식이어도 된다.
- 더 낫다면 Decisions data는 유지하고 패널 안에 짧은 성공 상태만 보여도 된다.
- 실패 시 화면 안에 짧은 오류를 보여라.

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`만.
- FreeLang core / `runtime/bootstrap.js` / nginx / PM2 설정 / 타 `skl-*` 서비스 변경 금지.
- Node/Express/Python API 서버 신설 금지. 페이지/API는 기존 `.flx` 경로만 사용.
- Followups, People, Decisions DB schema 변경 금지.
- People/Decisions 데이터를 자동 import, migration, background sync 하지 않는다.
- Followups 중복 방지 로직은 이번 범위가 아니다. 같은 버튼을 두 번 누르면 두 row가 생겨도 된다.
- `/followups/api` 계약을 깨지 않는다. 기존 action add/done/reopen/snooze/reschedule/delete 유지.
- `pages/followups/_db.flx`에 join용 함수 추가 금지. 출처 연결은 `source_type/source_id` 값으로만 표현한다.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- `logs/`, `*.db`, `.env`, 브라우저 프로필, 임시 JSON 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- push/blog는 팀장 검수 후.

## 예상 파일

예상 수정:

```text
pages/people/index.flx
pages/decisions/index.flx
FIX_2026-07-25-FOLLOWUPS-SOURCE-ACTIONS.md
```

빌드 산출로 다음이 바뀌면 포함 가능:

```text
.build-state.json
AGENTS.md
```

단, route 수가 늘지 않는다면 AGENTS route manifest는 바뀌지 않는 것이 정상일 수 있다.

## 완료 기준

### Build / Loop

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node fl-front-loop.js --dry
```

기대:

- build ok
- errors 0
- warnings 25, 또는 변동 시 code별 근거 설명
- `stdlibLoadOk true`
- `stdlibLsFnsCount 485`
- loop `converged true`
- `remainingFixableCount 0`

### HTTP / API

검증 데이터는 반드시 삭제하고 끝낸다.

1. `/people`, `/decisions`, `/followups` 모두 200.
2. People에서 만든 Followups row:
   - `source_type = "people"`
   - `source_id = "{people id}"`
   - `title`에 People 이름 포함.
3. Decisions에서 만든 Followups row:
   - `source_type = "decision"`
   - `source_id = "{decision id}"`
   - `title`에 Decision 제목 포함.
4. 두 검증 Followups row를 `/followups/api` delete로 삭제한다.
5. 최종 `/followups/api`에서 검증 title이 0건임을 확인한다.

### Browser / CDP

브라우저에서 최소 1회 직접 확인한다.

- `/people`: 행 펼침 → `후속 만들기` 클릭 → 화면 오류 0 → `/followups/api`에 row 생성.
- `/decisions`: 행 펼침 → `후속 만들기` 클릭 → 화면 오류 0 → `/followups/api`에 row 생성.
- Error Overlay `__FL_EO.list().length = 0`.
- Followups 검증 row 삭제 후 다시 0건 확인.

### 회귀

- 기존 People 기능: 행 펼침, 날짜 저장 또는 상태 토글 중 1개 정상.
- 기존 Decisions 기능: 행 펼침, 기존 결정/회고/삭제 흐름 중 위험 낮은 1개 정상. 검증 데이터 사용 시 삭제.
- Followups 기존 CRUD 중 add/delete 1회 정상.

## 보고 양식

보고는 “완료” 단정 대신 아래 형태로 남긴다.

```text
목적지 한 줄:

기준선:
- HEAD:
- build:
- loop:

구현:
- People → Followups:
- Decisions → Followups:
- 계약 유지:

검증:
- build/loop:
- HTTP/API:
- Browser/CDP:
- 회귀:
- 검증 데이터 삭제:

판단:
- 자동 import/join을 안 한 이유:
- 중복 방지를 이번에 안 한 이유:
- 구현 중 드러난 언어/도구 이슈:
- 범위 밖 관찰:

남긴 것:
- dirty:
- 보류 카운트:
- 커밋:
- push/blog:

남은 거리:
```
