# FIX — Followups Source Actions (2026-07-25)

## 범위

- `pages/people/index.flx` — 행 펼침 패널 `후속 만들기` → `POST /followups/api`
- `pages/decisions/index.flx` — 동일

## 구현

### People → Followups

- 버튼: `후속 만들기` (`.pe-panel` actions)
- `title`: `연락: {name}`
- `context`: tag · context · 다음연락 (비어 있지 않은 값만 ` · ` 조합)
- `due_date`: `next_touch` 있으면 그 값, 없으면 `@data.today`
- `source_type`: `people`, `source_id`: row id 문자열
- 성공: `Followups에 추가됨` (`.pe-ok`), 실패: `.pe-fu-err`

### Decisions → Followups

- 버튼: `후속 만들기` (`.dec-foot`)
- `title`: `후속: {title}`
- `context`: status-label · chosen · outcome · context
- `due_date`: `@data.today`
- `source_type`: `decision`, `source_id`: row id 문자열
- 성공/실패 UI: `.dec-ok` / `.dec-fu-err`

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25

node fl-front-loop.js --dry
# → converged true, remainingFixableCount 0

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/people
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/decisions
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/followups
# → 모두 200
```

### CDP (Chrome headless)

- `/people`: 행 펼침 → `후속 만들기` → `Followups에 추가됨`, `source_type=people`, title `연락: 검증용 김`
- `/decisions`: 행 펼침 → `후속 만들기` → `Followups에 추가됨`, `source_type=decision`, title `후속: 검증용 결정`
- `__FL_EO.list().length = 0`
- 검증 row + seed people/decision 모두 delete 후 `검증용` title 0건

### 회귀

- Followups add/delete curl OK

## 함정

1. **Island `[a b c]` 벡터 ≠ 벡터** — `[tag ctx x]`가 `(tag ctx x)` 함수 호출로 compile됨. `push` 체인으로 배열 구성해야 함.
2. **`let` 본문 다중 side-effect** — `(let [...] (reset! ...) (reset! ...) (fetch-post! ...))`는 JS `return reset!; dead code`로 compile됨. **`(do ...)` 필수**.
3. **People/Decisions data reload 없음** — Followups만 POST; People/Decisions `@data` 유지 + 패널 성공 메시지만 표시.
4. **자동 import/join 없음** — `source_type/source_id` 값만 저장; `_db.flx` join 함수 추가 안 함.
5. **중복 방지 없음** — 같은 버튼 두 번 누르면 row 2개 (지시서 범위).

## 남긴 것

- warnings 25 — 기준선 유지
- push/blog — 팀장 검수 후
- 보류: APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1
