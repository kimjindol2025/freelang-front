# 업무지시서 — People CRM MVP (freelang-front only)

**작성일**: 2026-07-25 KST
**역할**: Cursor 구현자 · Codex 팀장 검수
**집행 근거**: kim 지시 — 제품 앱을 freelang-front 패턴으로 계속 쌓는다. 스택은 **FreeLang `.flx` + Island + SQLite**만. Node/Express·외부 CRM·주소록 연동 금지.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.
어긋나면 구현하지 말고 지시서를 고친다.

예시 한 줄:

> `/people` — 사람·다음 연락일·한 줄 맥락을 Island+SQLite로 다루는 가벼운 CRM MVP. `/contacts`와 별개.

## 목적지

**People** 앱 1개를 freelang-front에 추가한다.

이번 작업의 부산은 다음이다.

- `pages/people/{_db,api,index}.flx` + 홈 카드
- GET/POST JSON API + Island UI (목록 · 추가 · 삭제 · 다음 연락 갱신)
- `FIX_2026-07-25-PEOPLE-CRM.md` (증상/원인 없으면 구현·검증 섹션으로)
- 빌드 통과 · PM2 `freelang-front`에서 curl 실측

## `/contacts`와의 관계 (중요)

| | `/contacts` (기존) | `/people` (이번 MVP) |
|--|-------------------|----------------------|
| 목적 | 풀 연락처 + activities | **관계 유지** 최소셋 |
| DB | `data/contacts.db` | **`data/people.db`** (신규, 독립) |
| 범위 | 회사·직함·리마인드·활동로그 | 이름 · 태그 · 맥락 · 다음연락일 · 상태 |
| 이번 작업 | **읽기만 / 수정 금지** | 여기만 구현 |

`/contacts`를 rename·이전·통합하지 않는다. MVP는 새 라우트 `/people`만.

## 현재 기준선

착수 시점에 반드시 다시 재확인한다.

```bash
cd /home/kim/kim/skl/freelang-front
git status --short --branch
git log --oneline -5 --decorate
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/contacts
```

참고 커밋(패턴):

- `380cfe9` — Decisions 다듬기 · Prompts · payload 충돌 교훈
- `82fd695` — Decisions MVP 골격

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front` **만**
- FreeLang 코어 / `runtime/bootstrap.js` / nginx / 타 skl-* 서비스 변경 금지
- Node/Express/Python API 서버 신설 금지 — **페이지·API 전부 `.flx`**
- Google/Apple/Android 주소록·OAuth·외부 CRM 연동 금지
- `/contacts` 스키마·UI·API 수정 금지
- `logs/` · `*.db` · `.env` 커밋 금지
- `git add -A` 금지. 의도한 파일만 stage
- APP-DB rename · undefined-fn/route-shadow 일괄 정리 착수 금지
  (**카운트 유지: `APP-DB rename 0/3` · `undefined-fn/route-shadow 실장애 0/1`**)
- push / 블로그는 사용자 `/gogs` 또는 명시 확인 후에만

### 함정 금지 (380cfe9에서 확인됨)

| ❌ 하지 말 것 | ✅ 할 것 |
|-------------|--------|
| `(defn payload [])` 공용 이름 | `(defn people-payload [])` |
| SQLite row에 `obj-merge` | `(get row "k")`로 명시 맵 |
| 서버 `reduce`+`str-split`+`concat`으로 줄 파싱 | Island에서 `str-split` / 단순 필드 |
| 서버에 무거운 가공 | payload는 `items` + 카운트 정도만 |

## 제품 범위 (MVP)

### 데이터 (`data/people.db`)

테이블 `people`:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | 이름 |
| `tag` | TEXT | 한 태그 (예: 고객/동료/가족) — MVP는 단일 문자열 |
| `context` | TEXT | 한 줄~짧은 맥락 |
| `next_touch` | TEXT | `YYYY-MM-DD` 또는 `''` |
| `status` | TEXT | `active` \| `dormant` (기본 `active`) |
| `created_at` | TEXT | `datetime('now','localtime')` |

하지 않는 것 (MVP 밖):

- 전화/이메일/회사 필드 (그건 `/contacts`)
- activities 테이블 · 리마인드 크론 · 푸시
- 다중 태그 UI · 검색 API 고도화 (클라이언트 필터면 충분)
- 상세 페이지 `people/[id].flx` (접기 패널로 대체)

### API (`/people/api`)

- **GET** → `people-payload`:
  ```json
  {
    "items": [ ... ],
    "active_count": N,
    "dormant_count": N,
    "due_count": N,
    "today": "YYYY-MM-DD"
  }
  ```
  - `due_count`: `status=active` 이고 `next_touch` ≠ `''` 이고 `next_touch <= today`
  - `today`는 SQL `date('now','localtime')` — **obj-merge로 row 붙이지 말고 키 복사**

- **POST** `action`:
  - `add` — name 필수, 나머지 선택
  - `delete` — id
  - `touch` — id + `next_touch` (다음 연락일 갱신)
  - `set-status` — id + `status` (`active`|`dormant`)

응답은 항상 `{"ok" true, ...people-payload}` 또는 400 에러.

### UI (`/people` Island)

모바일 우선 (Decisions 톤 참고 가능, 복붙 강요 없음).

필수:

1. 상단 카운트: 활성 / 휴면 / 오늘까지 연락
2. 필터 칩: 전체 · 오늘까지 · 활성 · 휴면
3. 행: 이름 · 태그 · `next_touch` · 상태 점
4. 펼침: context · 다음연락일 입력 · 저장(`touch`) · 휴면/활성 토글 · 삭제
5. 추가 폼: name / tag / context / next_touch
6. 터치: 행·버튼 `min-height` ≥ 44px, input `font-size: 16px`

SPA 링크: 홈 카드에서 `/people`.

### 홈

`pages/index.flx`에 카드 1개:

- 이름: People (또는 사람)
- desc: 다음 연락 · 관계 메모
- href: `/people`

## 작업 단계

### 1. scaffold

```
pages/people/_db.flx    ; (ns people) · PEOPLE-DB · init/all/count-*/add/delete/touch/set-status/today
pages/people/api.flx    ; people-payload · render · render_post
pages/people/index.flx  ; Island PeopleApp + layout-html
```

`(ns people)` → 호출은 `people-init`, `people-all`, …
`api.flx` / `index.flx`에서 `(load "pages/people/_db.flx")` `(people-init)`.

### 2. 빌드 · 기동

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js
# errors=0, Island 테스트 PASS
pm2 restart freelang-front
# 포트 :40860 — PM2만. HMR 필요 시에만 별도 npm run dev (동시 금지)
```

### 3. 검증 (필수 — 눈으로 OK 금지)

```bash
# 페이지
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/people
# → 200

# 페이로드 키
curl -sS http://127.0.0.1:40860/people/api | python3 -c \
  "import sys,json;d=json.load(sys.stdin);print(sorted(d.keys()))"
# → active_count, dormant_count, due_count, items, today

# 추가
curl -sS -X POST http://127.0.0.1:40860/people/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","name":"김테스트","tag":"고객","context":"견적 후속","next_touch":"2026-07-26"}'
# → ok true, items 증가

# contacts와 격리
curl -sS http://127.0.0.1:40860/contacts/api | head -c 120
# → contacts 스키마 그대로 (people 필드 없음)
```

회귀:

```bash
curl -sS -o /dev/null -w "dec:%{http_code} prompts:%{http_code}\n" \
  http://127.0.0.1:40860/decisions http://127.0.0.1:40860/prompts
curl -sS http://127.0.0.1:40860/decisions/api | python3 -c \
  "import sys,json;d=json.load(sys.stdin);assert 'today' in d and 'open_count' in d"
curl -sS http://127.0.0.1:40860/prompts/api | python3 -c \
  "import sys,json;d=json.load(sys.stdin);assert list(d.keys())==['items']"
```

### 4. FIX 문서

`FIX_2026-07-25-PEOPLE-CRM.md` — 필수 섹션:

```markdown
# FIX — People CRM MVP (날짜)

## 범위
## 구현 (파일·변경 요약)
## 검증 (curl 명령 + 결과)
## PM2
## 함정 (이번에도 피한 것)
```

## 완료 정의

- [ ] `/people` 200, Island로 추가·필터·touch·status·delete 동작
- [ ] `/people/api`에 `people-payload` 고유명, `today`·카운트 정상
- [ ] `data/people.db`만 사용, `/contacts` 무변경
- [ ] 홈 카드 존재
- [ ] 빌드 `errors=0`, Island 테스트 PASS
- [ ] Decisions/Prompts 회귀 curl OK
- [ ] FIX 문서 작성
- [ ] 보류 카운트 보고: **`APP-DB rename 0/3` · `undefined-fn/route-shadow 실장애 0/1`**
- [ ] 커밋·푸시·블로그는 사용자 `/gogs` 후에만

## 보고 형식 (구현 완료 시)

```
## People CRM MVP
- 한 줄 목적지: …
- 라우트: /people · /people/api
- 커밋(로컬): <hash or uncommitted>
- curl: today=… active=… due=…
- 회귀: decisions/prompts OK
- 보류: APP-DB rename 0/3 · undefined-fn/route-shadow 0/1
- 제외/미구현: …
```

## 참고 파일

- 패턴: `pages/prompts/{_db,api,index}.flx`, `pages/decisions/*`
- 함정: `FIX_2026-07-25-DECISIONS-PROMPTS-HMR.md`, `docs/TRAPS.md`
- 기존 CRM(손대지 말 것): `pages/contacts/*`
- AI 컨텍스트: `AGENTS.md` (빌드 후 `/people` 라우트 자동 등록 확인)
