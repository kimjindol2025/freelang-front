# FIX — Followups MVP (2026-07-25)

## 범위

- `pages/followups/{_db,api,index}.flx` — 후속 행동 보드 MVP
- `pages/index.flx` — 홈 카드 `/followups` 추가
- `island-compiler.js` — Island `(h! …)` 컴파일 버그 수정 (Followups 구현 중 발견)

## 구현

- **DB**: `data/followups.db` — `followups` 테이블 (title, context, due_date, status, source_type, source_id, created_at, done_at)
- **API**: `GET/POST /followups/api` — `followups-payload`, actions: add/done/reopen/snooze/reschedule/delete
- **UI**: Island `FollowupsApp` — 카운트·필터 칩·추가 폼·행 펼침·CRUD 버튼, `loaded` atom으로 fetch 1회
- **홈**: `pages/index.flx`에 Followups 카드

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25, stdlibLoadOk true, stdlibLsFnsCount 485

node fl-front-loop.js --dry
# → converged true, remainingFixableCount 0

pm2 restart freelang-front

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/followups
# → 200

curl -sS http://127.0.0.1:40860/followups/api
# → keys: items, open_count, due_count, done_count, snoozed_count, today

# CRUD (2026-07-25 기준)
curl -sS -X POST http://127.0.0.1:40860/followups/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","title":"김테스트 연락","context":"People 후속","due_date":"2026-07-25","source_type":"people","source_id":"1"}'
# → ok true, open_count 1, due_count 1

# done / reopen / snooze / reopen / reschedule / delete 각 1회 → 모두 ok true

curl -sS -o /dev/null -w "people:%{http_code} decisions:%{http_code} prompts:%{http_code}\n" \
  http://127.0.0.1:40860/people http://127.0.0.1:40860/decisions http://127.0.0.1:40860/prompts
# → people:200 decisions:200 prompts:200
```

## 브라우저 확인

Chrome headless/CDP (`/followups`):

- hard reload 후 `/followups/api` resource count = **1**
- `+ 추가` → 폼 4 inputs 표시 (h! 수정 후 Island Error 없음)
- 항목 추가 → `.fu-row=1`, title "CDP 테스트"
- 필터 "진행중" · 행 펼침 → `.fu-panel` + "완료" 버튼
- 완료 처리 후 Error Overlay `__FL_EO.list().length=0`
- 회귀 `/people` → `.pe-row>=1`, Island Error 없음

## 함정

- **`payload` 공용명 금지** — `(defn followups-payload [])` 사용
- **SQLite row `obj-merge` 금지** — row 읽기는 `(get row "k")` 명시 (POST 응답 merge는 People/Decisions와 동일 패턴)
- **Island `fetch!` 1회** — `loaded` atom + `(when (not @loaded) …)` 필수
- **`(length x)`** — compiler가 `((x)?.length ?? 0)` 괄호 처리됨; 필터 empty 비교 시 주의
- **`(h! …)` Island 미지원 (수정함)** — compiler가 `h!` → `h_bang()` 으로 emit했으나 런타임에 없어 폼/펼침 시 `ReferenceError`. `emitHBang` → `_fl.h(tag, attrs)` 로 수정
- **Error Overlay** — Followups CDP 검증 후 신규 오류 0

## 남긴 것

- People/Decisions DB 자동 import·join 없음 (MVP는 별도 DB)
- `data/followups.db` — git 미추적 (`.db` 커밋 금지)
- push/blog — 팀장 검수 후
- 보류 카운트: APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1
