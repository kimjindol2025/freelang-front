# 업무지시서 — Followups Source Navigation (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 지시 — freelang-front를 실제 앱 흐름으로 강화한다. Followups가 People/Decisions에서 생성되는 상태까지 왔으므로, 이제 Followups에서 출처를 확인하고 원본 앱으로 돌아가는 길을 만든다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> `/followups` 행 펼침 패널에서 `source_type/source_id`를 사람이 읽을 수 있게 보여주고, People/Decisions 원본 앱으로 돌아가는 링크를 제공한다.

질문은 미완이 아니라 완성도다. 아래 범위에서 애매하면 멈추고 질문한다.

## 목적지

현재 `/people`과 `/decisions`에서는 Followups row를 만들 수 있다. 하지만 `/followups`에서는 출처가 `출처 ID` 텍스트로만 보이고, 사용자가 원래 People/Decisions 화면으로 돌아갈 행동이 없다.

이번 작업은 `/followups`의 행 펼침 패널을 개선해 출처를 사람이 읽을 수 있게 표시하고, 원본 앱으로 돌아가는 링크를 제공한다.

끝 상태:

- manual row는 기존처럼 수동 출처로 보인다.
- people row는 `People #id` 또는 동등한 수준으로 출처가 보이고 `/people`로 이동할 수 있다.
- decision row는 `Decision #id` 또는 동등한 수준으로 출처가 보이고 `/decisions`로 이동할 수 있다.
- 상세 deep-link가 없으면 목록 앱으로만 이동한다. 상세 라우트 신설은 하지 않는다.
- Followups API/DB 계약은 변경하지 않는다.

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

- HEAD: `3752ccf` 이후 또는 그 이상
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

### `/followups` 행 펼침 패널

현재 패널의 `출처 ID: ...` 표시를 다음 수준으로 바꾼다.

필수 표시:

| source_type | 표시 |
|---|---|
| `manual` 또는 빈 값 | `출처: 수동` 또는 기존 수동 표시와 동등 |
| `people` | `출처: People #<source_id>` |
| `decision` | `출처: Decision #<source_id>` |

필수 행동:

| source_type | 링크 |
|---|---|
| `people` | `/people` |
| `decision` | `/decisions` |
| `manual` 또는 빈 값 | 링크 없음 |

링크 문구 예시:

- `People 열기`
- `Decision 열기`

링크는 일반 `<a href="/people">` / `<a href="/decisions">`면 충분하다. SPA 전환 속성은 기존 앱 패턴이 있으면 맞춰도 되지만, 새 라우팅 시스템을 만들지 않는다.

### 수동 추가 폼

기존 source_type/source_id 입력은 유지한다.

허용되는 작은 개선:

- source_type 선택값이 `manual/people/decision`임을 더 잘 보이게 하는 수준.
- source_id가 비어 있으면 수동 row처럼 링크를 숨기는 수준.

하지 않는 것:

- People/Decisions 목록을 불러와 select로 고르게 만들기.
- 이름/제목을 join해서 Followups payload에 붙이기.
- source 상세 존재 여부를 API에서 검증하기.

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`만.
- FreeLang core / `runtime/bootstrap.js` / nginx / PM2 설정 / 타 `skl-*` 서비스 변경 금지.
- Node/Express/Python API 서버 신설 금지. 페이지/API는 기존 `.flx` 경로만 사용.
- Followups, People, Decisions DB schema 변경 금지.
- `/followups/api` GET/POST 계약 변경 금지.
- People/Decisions DB를 읽는 join/import 코드 추가 금지.
- 상세 라우트 신설 금지. `/people/:id`, `/decisions/:id`, `/followups/:id` 만들지 않는다.
- 중복 방지, 자동 정리, overdue 필터 확장은 이번 범위가 아니다.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- `logs/`, `*.db`, `.env`, 브라우저 프로필, 임시 JSON 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- push/blog는 팀장 검수 후.

## 예상 파일

예상 수정:

```text
pages/followups/index.flx
FIX_2026-07-25-FOLLOWUPS-SOURCE-NAV.md
```

빌드 산출로 다음이 바뀌면 포함 가능:

```text
.build-state.json
```

route 수가 늘지 않는 작업이므로 `AGENTS.md` route manifest는 바뀌지 않는 것이 정상이다.

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

1. `/followups` 200.
2. `/people`, `/decisions` 200.
3. `/followups/api`에 검증 row 3개를 만든다.
   - manual: `source_type=manual`, `source_id=""`
   - people: `source_type=people`, `source_id="999001"`
   - decision: `source_type=decision`, `source_id="999002"`
4. `/followups` HTML 또는 Browser/CDP에서 세 row가 보인다.
5. 검증 row 3개를 `/followups/api` delete로 삭제한다.
6. 최종 `/followups/api`에서 검증 title 0건임을 확인한다.

### Browser / CDP

브라우저에서 직접 확인한다.

- manual row 펼침: 수동 출처 표시, People/Decision 링크 없음.
- people row 펼침: `People`과 `999001`이 보이고 `/people` 링크가 있다.
- decision row 펼침: `Decision`과 `999002`가 보이고 `/decisions` 링크가 있다.
- 링크 클릭 또는 href 평가로 대상이 각각 `/people`, `/decisions`임을 확인한다.
- Error Overlay `__FL_EO.list().length = 0`.

### 회귀

- Followups 기존 add/delete 1회 정상.
- Followups 기존 done/reopen 또는 snooze/reopen 중 하나 정상.
- People/Decisions에서 만든 source action 버튼은 깨지지 않아야 한다. 최소한 `/people`, `/decisions` 페이지 200과 버튼 텍스트 존재를 확인한다.

## 보고 양식

보고는 “완료” 단정 대신 아래 형태로 남긴다.

```text
목적지 한 줄:

기준선:
- HEAD:
- build:
- loop:

구현:
- Followups 출처 표시:
- source link 규칙:
- 계약 유지:

검증:
- build/loop:
- HTTP/API:
- Browser/CDP:
- 회귀:
- 검증 데이터 삭제:

판단:
- 상세 deep-link를 안 만든 이유:
- DB join/import를 안 한 이유:
- 구현 중 드러난 언어/도구 이슈:
- 범위 밖 관찰:

남긴 것:
- dirty:
- 보류 카운트:
- 커밋:
- push/blog:

남은 거리:
```
