# 업무지시서 — Market Source Actions + Followups Market Nav (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 지시 — FreeLang으로 백엔드와 프론트를 실제 제품 흐름까지 밀어붙여 부족분을 드러낸다. Market Core가 생겼으니 People → Market → Followups 연결을 닫아 C2C 기록 그래프를 만든다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시:

> People 행 펼침에서 Market listing을 만들 수 있게 하고, Followups에서 `source_type=market` row가 Market 출처와 `/market` 링크로 보이게 한다.

질문은 미완이 아니라 완성도다. 아래 범위에서 애매하면 멈추고 질문한다.

## 목적지

Market Core는 standalone C2C 보드까지 왔다. 다음 부족한 점은 People/Followups와의 연결이다.

이번 작업은 두 가지를 닫는다.

1. `/people` 행 펼침에서 해당 사람을 판매자/source로 삼아 `/market/api` listing을 생성한다.
2. `/followups` 행 펼침에서 `source_type=market`을 사람이 읽을 수 있게 표시하고 `/market`으로 돌아가는 링크를 제공한다.

끝 상태:

- People → Market listing 생성 가능
- Market → Followups 생성 흐름 유지
- Followups → Market 링크 가능
- People/Market/Followups DB schema 변경 없음
- DB join/import 없음
- compiler/build/fix 수정 없음, 실장애가 있으면 문서에 원인과 후보만 기록

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

- HEAD: `be2f782` 이후 또는 그 이상
- origin/master 동기 또는 이번 작업만 ahead
- build ok
- errors 0
- warnings 25, 또는 변동 시 code별 근거 설명
- `stdlibLoadOk true`
- `stdlibLsFnsCount 485`
- loop `converged true`, `remainingFixableCount 0`

dirty 제외 기준:

- `HANDOFF.airc`, `logs/`, runtime `*.db`는 커밋하지 않는다.
- `.build-state.json`은 build 산출 변경이 이번 route/diagnostic 상태와 맞을 때만 포함 가능하다.

## 제품 범위

### People → Market

`pages/people/index.flx`의 row 펼침 패널에 Market listing 생성 액션을 추가한다.

필수 입력/동작:

- 버튼 또는 작은 폼: `Market에 올리기`
- listing title 기본값: 사람 이름을 포함하되 사용자가 수정 가능해야 한다.
- price/category/description/contact/neighborhood 최소 입력을 둔다.
- `source_type`: `people`
- `source_id`: People row id 문자열
- 성공 시 People 패널에 성공 메시지를 보여준다.
- 실패 시 People 패널에 실패 메시지를 보여준다.
- 생성 후 `/market`에서 해당 listing이 보여야 한다.

허용:

- People row 안에 간단한 입력 필드를 직접 두기.
- v1에서는 photo_url 비워두기.
- seller 이름을 Market DB에 복제하지 않고 source_id만 저장.

금지:

- People DB schema 변경
- Market DB schema 변경
- People DB와 Market DB join/import
- `/people/:id` 또는 `/market/:id` 상세 라우트 신설
- 중복 방지 UX 착수

### Followups → Market Nav

`pages/followups/index.flx`의 source 표시를 확장한다.

필수 표시:

| source_type | 표시 |
|---|---|
| `manual` | 출처: 수동 |
| `people` | 기존 유지 |
| `decision` | 기존 유지 |
| `market` | 출처: Market #`source_id` |

링크 규칙:

- `market` + `source_id` 있음 → `/market`, `data-spa="1"`
- id 없음 → 링크 숨김
- 기존 people/decision 링크 유지

금지:

- Followups API/DB 계약 변경
- Market title 조회를 위한 join/import
- 상세 라우트 신설

## 언어 강화 관찰

이번 보고에는 아래를 반드시 채운다. “없음”이면 없음이라고 쓴다.

1. 막힌 문법/컴파일 지점
2. 우회한 패턴
3. 진단으로 올릴 후보
4. compiler/build/fix 수정 필요 여부
5. 검증 함정
6. 공통 패턴 후보
7. 언어 강화 우선순위: `now / next / later / hold`

특히 이번에는 아래 반복 후보를 관찰한다.

- People/Market/Followups의 source action 코드가 얼마나 복붙되는가
- action별 `fetch-post!` 성공/실패 처리 패턴이 helper/template 후보인지
- row 펼침 안에 form이 들어갈 때 Island 상태 atom이 읽기 어려워지는지
- `do` 없는 다중 side-effect, vector literal, `cond` DOM 반환 함정이 다시 나오는지

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`만.
- FreeLang core / `runtime/bootstrap.js` / nginx / PM2 설정 / 타 서비스 변경 금지.
- Node/Express/Python API 서버 신설 금지.
- `pages/market/_db.flx`, `pages/people/_db.flx`, `pages/followups/_db.flx` schema 변경 금지.
- 사진 업로드 착수 금지.
- 채팅 착수 금지.
- compiler/build/fix 수정 금지. 실장애가 있으면 후보로 문서화하고 멈춘다.
- APP-DB rename 착수 금지. 카운트 0/3 유지.
- undefined-fn/route-shadow 일괄 정리 금지. 실장애 0/1 유지.
- `logs/`, `*.db`, `.env`, 브라우저 프로필, 임시 JSON 커밋 금지.
- `git add -A` 금지. 의도 파일만 stage.
- push/blog는 팀장 검수 후.

## 예상 파일

예상 수정:

```text
pages/people/index.flx
pages/followups/index.flx
FIX_2026-07-25-MARKET-SOURCE-ACTIONS.md
```

빌드 산출로 다음이 바뀌면 포함 가능:

```text
.build-state.json
```

라우트 추가가 아니므로 `AGENTS.md`는 바뀌지 않는 것이 정상이다.

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

1. `/people`, `/market`, `/followups` 모두 200.
2. People 검증 row 1개를 만든다.
3. People UI 또는 API+CDP 흐름으로 `Market에 올리기`를 실행한다.
4. `/market/api`에서 생성 row가 보이고 `source_type=people`, `source_id=<people id>`가 맞다.
5. Market row에서 기존 `후속 만들기`를 실행한다.
6. `/followups/api`에서 `source_type=market`, `source_id=<market id>` row가 보인다.
7. 검증 People/Market/Followups row를 삭제한다.
8. 최종 API에서 검증 title 0건임을 확인한다.

### Browser / CDP

- People row 펼침에 `Market에 올리기`가 보인다.
- 입력 후 Market listing 생성 성공 메시지가 보인다.
- `/market`에서 생성 row가 표시된다.
- Market row의 `후속 만들기`가 유지된다.
- `/followups`에서 market source row를 펼치면 `출처: Market #<id>`와 `/market` 링크가 보인다.
- `window.__FL_EO.list().length = 0`

### 회귀

- 기존 People → Followups `후속 만들기` 유지
- 기존 Decisions → Followups `후속 만들기` 유지
- 기존 Followups people/decision source nav 유지
- Market add/set-status/update-contact/delete 유지

## 보고 양식

보고는 아래 순서로 한다.

```text
목적지 한 줄:

기준선:
- HEAD:
- status:
- build:
- loop:

구현:
- People → Market:
- Followups market nav:
- 계약 유지:

검증:
- build/loop:
- HTTP/API:
- CDP:
- cleanup:
- 회귀:

언어 강화 관찰:
- 막힌 문법/컴파일:
- 우회:
- 진단 후보:
- compiler/build/fix 필요:
- 검증 함정:
- 공통 패턴 후보:
- 우선순위:

판단:
- 왜 이 범위로 닫았는지:
- 다음 후보:

남긴 것:
- dirty:
- 제외:
- 보류 카운트:
- commit/push/blog:
```

## 다음 후보

이 작업이 통과하면 다음 부산은 둘 중 하나다.

1. `MARKET-PHOTO-ONE` — photo_url 텍스트를 실제 업로드/썸네일 흐름으로 밀어붙임
2. `MARKET-CHAT-POLLING` — listing 기준 1:1 메시지와 폴링으로 Island 비동기 한계 확인
