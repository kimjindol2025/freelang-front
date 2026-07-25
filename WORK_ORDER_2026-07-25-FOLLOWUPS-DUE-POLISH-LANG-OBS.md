# 업무지시서 — Followups Due Polish + Language Observations (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 지시 — 앞으로의 방향은 freelang-front가 프론트 언어로 부족한 지점을 실제 앱 구현으로 채우는 것이다. Followups는 생성·출처 연결까지 됐으니, 오늘 처리 보드로서 시간 필터와 overdue 표시를 보강하면서 Island 문법·컴파일·진단·검증 패턴의 부족분을 관찰하고 보강 후보로 남긴다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> `/followups`를 오늘 처리 보드답게 만들기 위해 open row의 overdue/today/tomorrow/week/none 필터와 표시를 클라이언트 쪽에서 추가하고, 구현 중 드러난 FreeLang 프론트 언어 관찰을 별도로 보고한다.

질문은 미완이 아니라 완성도다. 아래 범위에서 애매하면 멈추고 질문한다.

## 목적지

Followups는 이제 People/Decisions에서 생성되고 출처로 돌아갈 수 있다. 다음 부족한 점은 “오늘 뭘 해야 하는지”를 더 잘 보는 것이다.

이번 작업은 `/followups`의 필터/표시를 보강해 사용자가 overdue, today, tomorrow, week, no-date 항목을 구분할 수 있게 한다.

동시에 이번 작업은 freelang-front 언어 강화 관찰을 수집하는 작업이다. 앱 구현 중 문법/컴파일/Island/진단/검증에서 실제로 막힌 점이 있으면 반드시 보고한다. 단, 실장애가 아니라면 compiler/build/fix 수정은 하지 않는다.

## 장기 방향

이 지시서부터 기본 방향을 아래처럼 고정한다.

1. 앱을 먼저 만든다.
2. 앱을 만들며 실제로 막힌 프론트 언어 부족분을 기록한다.
3. 반복되는 부족분만 helper, template, diagnostic, compiler 수정 후보로 올린다.
4. 실장애가 아니면 이번 앱 작업 안에서 compiler/build/fix를 건드리지 않는다.
5. 보고에는 “제품 기능이 됐는가”와 “언어가 어디서 부족했는가”를 둘 다 남긴다.

현재까지 확인된 부족분:

| 영역 | 부족한 점 | 이번 작업에서 볼 것 |
|---|---|---|
| Island 문법 | `cond` DOM 반환, vector literal, `do` 없는 다중 side-effect가 예측 어렵다 | 날짜 필터/표시 분기에서 같은 함정이 반복되는지 |
| 컴파일 예측성 | 작성자가 기대한 구조와 JS emit이 다를 수 있다 | filter/helper/날짜 계산 emit이 직관적인지 |
| 진단 | 일부 프론트 함정은 build 전에 충분히 못 잡는다 | 새 실수 중 진단으로 올릴 만한 것이 있는지 |
| 앱 패턴 | `loaded atom`, `apply-res`, row expand, source link가 손복붙이다 | 공통 helper/template 후보가 생기는지 |
| 검증 | Island re-render 후 stale DOM 같은 테스트 함정이 있다 | CDP 검증에서 재사용 가능한 규칙이 필요한지 |

이번 작업의 목적은 부족분을 전부 고치는 것이 아니다. **반복 증거를 수집하고, 실제 앱을 망가뜨리는 것만 좁게 고친다.**

끝 상태:

- `/followups`에서 overdue/today/tomorrow/week/none을 구분해 볼 수 있다.
- 기존 전체/진행중/완료/보류 흐름은 깨지지 않는다.
- source navigation 링크는 유지된다.
- API/DB 계약은 변경하지 않는다.
- 새 warning을 만들지 않는다.
- 언어 강화 관찰이 보고서에 남는다.

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

- HEAD: `1f54d72` 이후 또는 그 이상
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

### 필터

기존 필터를 전부 버리지 말고, 사용자가 실제로 오늘 일을 고르는 데 필요한 필터를 추가하거나 재배치한다.

필수 필터 의미:

| 키 | 의미 |
|---|---|
| `overdue` | `status=open`, `due_date != ""`, `due_date < today` |
| `today` | `status=open`, `due_date = today` |
| `tomorrow` | `status=open`, `due_date = tomorrow` |
| `week` | `status=open`, `today <= due_date <= today+6일` |
| `none` | `status=open`, `due_date = ""` |

기존 필터 의미는 유지한다:

| 키 | 의미 |
|---|---|
| `all` | 전체 |
| `open` | 진행중 |
| `done` | 완료 |
| `snoozed` | 보류 |

`due` 필터는 남겨도 되고 `overdue/today`로 대체해도 된다. 대체할 경우 UI와 보고에서 이유를 명시한다.

### 날짜 계산

우선순위:

1. 이미 프론트 Island에서 사용할 수 있는 안정적인 JS 날짜 방식이 있으면 사용한다.
2. 없다면 `/followups/api`의 `today` 문자열을 기준으로 작은 클라이언트 helper를 만든다.
3. API payload 확장은 하지 않는다. `tomorrow`나 `week_end`를 서버에서 새로 내려주지 않는다.

주의:

- 날짜 문자열은 `YYYY-MM-DD` 기준으로 비교한다.
- timezone은 API의 `today`를 정본으로 본다.
- 브라우저 local date와 API today가 어긋날 수 있으므로 `new Date()`만 정본으로 쓰지 않는다.

### 표시

행 meta 또는 dot/status 표시에서 다음을 구분한다.

필수 표시:

- overdue row: `지남` 또는 동등한 짧은 문구.
- today row: 기존 `오늘까지` 유지 가능.
- tomorrow row: `내일`.
- no-date row: `기한 없음` 또는 기존 `날짜 없음` 유지 가능.

권장:

- overdue는 today보다 강한 색으로 보이게 한다.
- tomorrow/week는 과한 색을 쓰지 않는다.
- 버튼/칩은 모바일 터치 기준 `min-height >= 44px` 유지.

### 카운트

상단 stats는 크게 바꾸지 않아도 된다.

허용:

- `오늘까지` 카운트를 overdue+today 의미로 유지.
- 별도 overdue count를 클라이언트에서 표시.

금지:

- DB query/API count 추가.
- `/followups/api` payload 계약 변경.

## 언어 강화 관찰

이번 보고에는 아래 항목을 반드시 채운다. “없음”이면 없음이라고 쓴다.

1. **막힌 문법/컴파일 지점**
   - 예: `cond`가 DOM node를 반환할 때 깨짐, vector literal이 함수 호출로 compile됨, 다중 side-effect에 `do` 필요.
2. **우회한 패턴**
   - 예: `if` 중첩, `push` 체인, helper 분리, 문자열 날짜 비교.
3. **진단으로 올릴 후보**
   - 실제로 한 번 이상 헷갈렸고 build가 잡지 못한 경우만.
4. **compiler/build/fix 수정 필요 여부**
   - 이번 작업에서 실장애가 아니면 “후보만 기록, 착수 없음”으로 남긴다.
5. **검증 함정**
   - 예: Island re-render 후 stale DOM 재사용 금지, CDP click 후 row 재조회 필요.
6. **공통 패턴 후보**
   - 이번 구현에서 또 복붙한 패턴이 있으면 helper/template 후보로 적는다.
   - 예: 날짜 chip 필터, row meta label, `loaded` 1회 fetch, `apply-res` 초기화, source link.
7. **언어 강화 우선순위**
   - 후보를 `now / next / later / hold` 중 하나로 분류한다.
   - `now`: 이번 앱이 깨져서 고쳐야 함.
   - `next`: 다음 지시서 후보.
   - `later`: 반복 증거 더 필요.
   - `hold`: 실장애 없어서 보류.

이 섹션은 제품 기능과 별개로 freelang-front 강화의 핵심 산출물이다.

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`만.
- FreeLang core / `runtime/bootstrap.js` / nginx / PM2 설정 / 타 `skl-*` 서비스 변경 금지.
- Node/Express/Python API 서버 신설 금지. 페이지/API는 기존 `.flx` 경로만 사용.
- Followups DB schema 변경 금지.
- `/followups/api` GET/POST 계약 변경 금지.
- People/Decisions DB join/import 금지.
- source navigation 제거 또는 깨뜨리기 금지.
- 중복 방지 UX 착수 금지.
- 상세 라우트 신설 금지.
- compiler/build/fix 수정은 이번 앱 구현 중 실제 runtime/blocker가 확인된 경우에만. 단순 후보면 문서에만 남긴다.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- `logs/`, `*.db`, `.env`, 브라우저 프로필, 임시 JSON 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- push/blog는 팀장 검수 후.

## 예상 파일

예상 수정:

```text
pages/followups/index.flx
FIX_2026-07-25-FOLLOWUPS-DUE-POLISH-LANG-OBS.md
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

1. `/followups`, `/people`, `/decisions` 모두 200.
2. `/followups/api`에 검증 row 최소 5개를 만든다.
   - overdue: `due_date = today 이전 날짜`
   - today: `due_date = today`
   - tomorrow: `due_date = tomorrow`
   - week: `due_date = today+3일`
   - none: `due_date = ""`
3. `/followups/api` 계약이 기존 key를 유지하는지 확인한다.
4. 검증 row를 `/followups/api` delete로 삭제한다.
5. 최종 `/followups/api`에서 검증 title 0건임을 확인한다.

### Browser / CDP

브라우저에서 직접 확인한다.

- overdue 필터: overdue row만 보인다.
- today 필터: today row만 보인다.
- tomorrow 필터: tomorrow row만 보인다.
- week 필터: today/tomorrow/week row가 보이고 overdue/none은 제외된다.
- none 필터: due_date 빈 row만 보인다.
- done/snoozed 필터 기존 동작 유지.
- source navigation row를 하나 펼쳐 People/Decision 링크가 아직 보이는지 확인한다.
- Error Overlay `__FL_EO.list().length = 0`.
- Island re-render 후 DOM을 다시 query해서 판정한다.

### 회귀

- Followups add/delete 1회 정상.
- Followups done/reopen 또는 snooze/reopen 중 하나 정상.
- People/Decisions source action 버튼 텍스트 존재.
- build warnings가 25에서 늘었다면, 새 warning은 커밋 전 제거하거나 팀장 검수용 근거를 명확히 남긴다.

## 보고 양식

보고는 “완료” 단정 대신 아래 형태로 남긴다.

```text
목적지 한 줄:

기준선:
- HEAD:
- build:
- loop:

구현:
- 필터:
- 날짜 계산:
- 표시:
- 계약 유지:

검증:
- build/loop:
- HTTP/API:
- Browser/CDP:
- 회귀:
- 검증 데이터 삭제:

언어 강화 관찰:
- 막힌 문법/컴파일 지점:
- 우회한 패턴:
- 진단 후보:
- compiler/build/fix 수정 필요 여부:
- 검증 함정:
- 공통 패턴 후보:
- 언어 강화 우선순위:

판단:
- API payload를 안 늘린 이유:
- DB schema를 안 바꾼 이유:
- due 필터 유지/대체 이유:
- 범위 밖 관찰:

남긴 것:
- dirty:
- 보류 카운트:
- 커밋:
- push/blog:

남은 거리:
```
