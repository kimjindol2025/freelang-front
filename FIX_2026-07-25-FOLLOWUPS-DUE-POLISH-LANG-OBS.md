# FIX — Followups Due Polish + Language Observations (2026-07-25)

## 범위

- `pages/followups/index.flx` — overdue/today/tomorrow/week/none 필터·표시·클라이언트 overdue count

## 구현

### 필터

| 키 | 의미 |
|---|---|
| `overdue` | open, `due_date < today` |
| `today` | open, `due_date = today` |
| `tomorrow` | open, `due_date = tomorrow` |
| `week` | open, `today <= due_date <= today+6` |
| `none` | open, `due_date = ""` |
| `all/open/done/snoozed` | 기존 유지 |

**`due`(오늘까지) 필터 대체**: overdue와 today를 분리해 “오늘 처리 보드”에 맞게 재배치. 서버 `due_count`(overdue+today) stat은 유지.

### 날짜 계산

- 정본: `/followups/api`의 `today` (`YYYY-MM-DD`)
- 페이지 `<script>`에 `date_add_days(ymd,n)` — **API today 문자열을 seed**로 Date 연산 (local `new Date()` 단독 정본 금지)
- Island에서 `(date-add-days td 1)` → 전역 `date_add_days()` 호출

### 표시

- meta: `기한 없음` / 날짜 + ` · 지남` / ` · 오늘까지` / ` · 내일`
- dot color: overdue `#FF3B30` > today `#FF5B35` > default `#4C8DFF`
- stats: `지남` overdue-count (클라이언트 filter length)

### 계약 유지

- `/followups/api` payload keys 변경 없음
- source navigation 링크 유지
- DB schema 변경 없음

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25

node fl-front-loop.js --dry
# → converged true
```

### CDP (today=2026-07-25)

| 필터 | 보이는 row |
|---|---|
| 지남 | DUE검증-overdue |
| 오늘 | DUE검증-today, DUE검증-source |
| 내일 | DUE검증-tomorrow |
| 7일 | today+tomorrow+week+source (overdue/none 제외) |
| 기한없음 | DUE검증-none |
| 완료 | (empty) |

- source row: `People #999001`, `/people` 링크 OK
- `__FL_EO.list().length = 0`
- snooze/reopen, add/delete 회귀 OK
- People/Decisions `후속 만들기` 텍스트 존재
- 검증 row 삭제 후 `DUE검증*` 0건

## 언어 강화 관찰

### 1. 막힌 문법/컴파일 지점

- **`(cond … (h "a" …))` → compile `null`** (Source Nav 작업에서 확인, 이번에도 `due-label`은 문자열만 `cond` 사용)
- **`[tag ctx x]` vector literal → `(tag ctx x)` 함수 호출** (Source Actions)
- **`let` 본문 다중 side-effect → `return` 뒤 dead code** — `(do …)` 필수 (Source Actions)
- **Island에 `str-to-num`/날짜 stdlib 없음** — 이번 due helper는 페이지 script 전역 `date_add_days` 우회

### 2. 우회한 패턴

- API `today` + `<script>date_add_days</script>` + Island `(date-add-days td n)`
- 날짜 비교는 `YYYY-MM-DD` **문자열 비교** (`<`, `=`, `>=`)
- DOM node 분기는 **`if` 중첩**, 문자열 분기는 `cond` OK
- 필터 chip 가로 스크롤 + `min-height:44px` 유지

### 3. 진단 후보

- Island `(cond … (h …))` compile null — build가 잡지 못함, runtime만 터짐
- `[sym …]` 리터럴이 함수 호출로 compile — arity/undefined-fn 진단 없음
- `let` multi-body side-effect dead code — compile 성공, fetch 미실행

### 4. compiler/build/fix 수정 필요 여부

- **후보만 기록, 착수 없음** (이번 작업 runtime blocker 없음 — `if`/`do`/script 우회로 해결)

### 5. 공통 패턴 후보

- 날짜 chip 필터: `today/tomorrow/week/none` 계산과 row 필터가 다음 앱에서도 반복될 가능성 있음
- row meta label: source label + due label + status label 조합이 손복붙으로 늘어남
- source link: `source_type/source_id` 표시와 앱 이동 링크가 Followups 전용 코드에 갇혀 있음
- Island fetch 패턴: `loaded` 1회 fetch, `apply-res`, row expand 후 CRUD가 People/Decisions/Followups에 반복됨
- CDP 검증 규칙: Island re-render 뒤 stale node 폐기, chip click 뒤 row 재query가 재사용 규칙 후보

### 6. 언어 강화 우선순위

| 우선순위 | 항목 | 판단 |
|---|---|---|
| now | 없음 | 이번 앱은 우회로 제품 기능이 통과했고 runtime blocker 없음 |
| next | `cond` DOM compile null, vector literal 오해, `let` multi-body dead code 진단 | 반복 증거가 쌓였고 build가 미리 못 잡는 영역 |
| later | 날짜 helper/template, source link helper, fetch/apply-res template | 앱 1~2개 더 쌓아 공통 형태가 안정되면 추출 |
| hold | compiler/build/fix 직접 수정 | 앱이 깨지는 실증 전까지 보류 |

### 7. 검증 함정

- Island re-render 후 **chip 클릭마다 `.fu-main` 접힌 뒤 재query** 필요
- today 필터에 `due_date=today`인 source row도 포함됨 (정상)
- PM2 restart 직후 curl CDP — server ready 대기 필요

## 남긴 것

- push/blog — 팀장 검수 후
- 보류: APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1
