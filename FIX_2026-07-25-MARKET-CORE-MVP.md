# FIX — Market Core MVP (2026-07-25)

## 범위

- `pages/market/{_db,api,index}.flx` — 동네장터 MVP (당근 inspired)
- `pages/index.flx` — 홈 카드 `/market` 추가

## 구현

- **DB**: `data/market.db` — `listings` 테이블
  - title, price, category, description, status(open|reserved|sold)
  - contact, neighborhood, photo_url
  - source_type, source_id (People 연결용)
- **API**: `GET/POST /market/api` — `market-payload`, actions: add|set-status|update-contact|delete
- **UI**: Island `MarketApp` — 썸네일·카운트·상태/카테고리 필터·글쓰기·행 펼침·연락 저장·예약/완료·후속 만들기
- **연결**: Market → Followups `후속 만들기` (`source_type=market`)
- **홈**: `pages/index.flx`에 Market 카드 (🥕)

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → ok true, errors 0, warnings 25

node fl-front-loop.js --dry

pm2 restart freelang-front

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/market
# → 200

curl -sS http://127.0.0.1:40860/market/api
# → keys: items, open_count, reserved_count, sold_count

curl -sS -X POST http://127.0.0.1:40860/market/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","title":"테스트 책상","price":"50000","category":"가구","description":"상태 좋음","contact":"010-1234","neighborhood":"역삼동"}'
# → ok true, open_count 1

# set-status reserved → sold → delete 각 ok true

curl -sS -o /dev/null -w "people:%{http_code} followups:%{http_code} decisions:%{http_code}\n" \
  http://127.0.0.1:40860/people http://127.0.0.1:40860/followups http://127.0.0.1:40860/decisions
# → people:200 followups:200 decisions:200
```

## 함정

- **`market-payload` 고유명** — 전역 `payload` 충돌 금지
- **Island `loaded` atom** — fetch 1회 필수
- **`(h! …)` in Island** — island-compiler 수정됨 (Followups 때와 동일)
- **mk-meta `(if neighborhood …)`** — then/else 각 줄 분리 (`""` / `(str …)`) 안 하면 괄호 추적 어려움
- **`check-parens.py`** — Island+`"""` CSS 블록에서 People도 false positive (3개 미닫힘). **실제 판정은 `fl-front-build.js`**
- **사진** — v1은 `photo_url` 텍스트 필드만 (업로드·썸네일 파이프라인은 다음 stress test)
- **채팅** — 연락처/메모 필드로 대체 (1:1 채팅은 범위 밖)

## 남긴 것

- People 행에서 `Market에 올리기` (SOURCE-ACTIONS) — 미구현
- Followups에서 `source_type=market` 라벨/링크 — 미구현
- `data/market.db` git 미추적
- push/blog — kim 승인 후
