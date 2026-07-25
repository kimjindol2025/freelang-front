# FIX — Followups Source Navigation (2026-07-25)

## 범위

- `pages/followups/index.flx` — 행 펼침 패널 출처 표시 + People/Decisions 링크

## 구현

### 출처 표시 (펼침 패널)

| source_type | 표시 |
|---|---|
| `manual` / 빈 값 | `출처: 수동` |
| `people` | `출처: People #<source_id>` |
| `decision` | `출처: Decision #<source_id>` |

### source link

| source_type | 조건 | 링크 |
|---|---|---|
| `people` | `source_id` 비어 있지 않음 | `<a href="/people" data-spa="1">People 열기</a>` |
| `decision` | `source_id` 비어 있지 않음 | `<a href="/decisions" data-spa="1">Decision 열기</a>` |
| `manual` | — | 링크 없음 |

### 폼 (소폭)

- source_type option: `manual · 수동` / `people · People` / `decision · Decision`
- source_id placeholder: `source_id (people/decision일 때)`

### API/DB

- 변경 없음 (`/followups/api` 계약 유지, join/import 없음)

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25

node fl-front-loop.js --dry
# → converged true

# 검증 row 3개 add (manual / people#999001 / decision#999002) → CDP 확인 → delete
# 최종 NAV검증 title 0건
```

### CDP

- manual: `출처: 수동`, 링크 없음
- people: `출처: People #999001`, `People 열기` → `/people`
- decision: `출처: Decision #999002`, `Decision 열기` → `/decisions`
- `__FL_EO.list().length = 0`

### 회귀

- Followups snooze/reopen, add/delete OK
- People/Decisions `후속 만들기` 버튼 존재 (행 펼침 시)

## 함정

- **Island `cond` + `h "a"`** — `(cond … (h "a" …) … true "")` 가 compile 시 `null` 반환. **`if` 중첩**으로 DOM 노드 분기해야 함.
- **상세 deep-link 없음** — `/people`, `/decisions` 목록만. `/:id` 라우트 신설 금지(지시서).
- **DB join 없음** — 이름/제목은 payload에 붙이지 않음. `source_type/source_id`만 표시.

## 남긴 것

- push/blog — 팀장 검수 후
- 보류: APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1
