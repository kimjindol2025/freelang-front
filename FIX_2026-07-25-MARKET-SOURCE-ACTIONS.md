# FIX — Market Source Actions (2026-07-25)

## 범위

- `pages/people/index.flx` — 행 펼침 `Market에 올리기` (입력 폼 + `/market/api` POST)
- `pages/followups/index.flx` — `source_type=market` 표시 + `/market` SPA 링크

## 구현

### People → Market

- 펼침 패널에 Market 입력: title(기본 `판매: {name}`), price, category, description, contact, neighborhood
- `make-market` → `POST /market/api` action=add, `source_type=people`, `source_id=<people id>`
- 성공: `Market에 등록됨` / 실패: 패널 에러 메시지
- 행 열 때 mk-* atom 초기화 (context → description 기본값)

### Followups → Market Nav

- `source-label`: market → `Market`
- `source-panel-text`: `출처: Market #id`
- `source-has-link?`: market + source_id 있을 때
- `source-link-view`: `Market 열기` → `/market` (`data-spa="1"`)

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25

node fl-front-loop.js --dry
# → converged true, remainingFixableCount 0

pm2 restart freelang-front

curl -sS -o /dev/null -w "people:%{http_code} market:%{http_code} followups:%{http_code}\n" \
  http://127.0.0.1:40860/people http://127.0.0.1:40860/market http://127.0.0.1:40860/followups
# → 200 200 200

# API chain (검증 후 삭제):
# people add → market add(source_type=people) → followups add(source_type=market) → delete all
# → source_type/source_id 일치, cleanup 후 title 0건

curl -sS -o /dev/null -w "decisions:%{http_code}\n" http://127.0.0.1:40860/decisions
# → 200
```

### 팀장 CDP 재검증

- People row 생성 후 브라우저에서 펼침 → `Market에 올리기` 버튼으로 listing 생성
- `/market/api`: 생성 row `source_type=people`, `source_id=<people id>` 확인
- `/market`: 생성 row 펼침 → `출처: People #<id>`, `/people` 링크, `후속 만들기` 성공
- `/followups/api`: `source_type=market`, `source_id=<market id>` row 확인
- `/followups`: 생성 row 펼침 → `출처: Market #<id>`, `/market` 링크 확인
- Error Overlay: People/Market/Followups 각 단계 `0`
- cleanup: People/Market/Followups 검증 row 최종 `0`

## 함정

- **`make-market` 괄호** — `(do` + `(if` + `fetch-post!` + `(fn [res]` + `(if` → pid 뒤 `)` **7개** 필요 (`make-followup`과 동일)
- **공유 mk-* atom** — 펼침 row 1개만 편집 가능 (edit-touch/fu-ok 패턴과 동일)
- **CDP** — Island re-render 뒤 기존 DOM 참조를 믿지 말고 row를 다시 찾아야 함

## 언어 강화 관찰

| 항목 | 내용 |
|------|------|
| 막힌 문법 | `make-market` fn 닫는 `)` 1개 부족 → build line 271 `]` 오탐 |
| 우회 | People/Followups source action 패턴 그대로 복붙 (별도 helper 없음) |
| 진단 후보 | source action boilerplate (`fetch-post!` + ok/err atom) |
| compiler/build/fix | **불필요** |
| 검증 함정 | curl 여러 URL 한 줄 → HTML 덤프; API는 POST 따로 |
| 공통 패턴 | `make-*` + `{app}-ok-id` + `{app}-err` atom 쌍 |
| 우선순위 | **next**: source-action helper / **later**: row 펼침 form atom namespace |

## 남긴 것

- DB/API schema 변경 없음
- push/blog — 지시서: 팀장 검수 후
