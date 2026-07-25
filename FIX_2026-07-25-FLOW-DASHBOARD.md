# FIX — C2C Flow Dashboard (2026-07-25)

## 범위

- `pages/flow/index.flx` — People → Market → Followups 파이프라인 대시보드 (Island `FlowApp`)
- `pages/index.flx` — hero 버튼 + 앱 카드 `C2C Flow` 링크

## 구현

### `/flow` Island UI

- 3 API 병렬 fetch: `/people/api`, `/market/api`, `/followups/api` (DB join 없음, 클라이언트 lookup)
- 파이프라인: People / Market / Followups 건수 + SPA 링크
- stat 5칸: People 활성, Market 판매중, Followups 진행, People→Market, Market→FU
- **연결된 흐름**: `source_type=market` followups 기준 3단 체인 (People lookup via market.source_id)
- **People → Market**: `source_type=people` listings 목록
- 새로고침 버튼 (`reload-all`)

## 빌드 함정 (괄호)

1. `let` 바인딩 벡터는 `pm-row` fn 뒤 `]` 로 닫기 (line 105)
2. island body 끝 `(if err …)` 뒤 `)` **7개** — let + island 포함 (6개면 line 3 미닫힘 오류)
3. Island `map` 안 맵 리터럴 `{"k" v}` → JS 컴파일 실패 → fn 인자로 직접 lookup (`chain-row`가 `fu` 받아 lookup)

## 검증

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → errors 0, Island 11/11 PASS

pm2 restart freelang-front

curl -sS -o /dev/null -w "flow:%{http_code}\n" http://127.0.0.1:40860/flow
# → flow:200
```

## PM2

```bash
pm2 restart freelang-front
```
