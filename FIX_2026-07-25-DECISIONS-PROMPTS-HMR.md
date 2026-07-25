# FIX — freelang-front Decisions 다듬기 + Prompts + HMR 실측 (2026-07-25)

## 증상
1. Decisions API가 Prompts JSON을 반환하거나 hang
2. 날짜 필터용 `today`/`week_start`/`month_start`가 응답에 없음
3. HMR을 PM2 `start`와 구분해서 `npm run dev`로 확인 필요

## 원인
1. **전역 함수명 충돌**: `api.flx`의 `(defn payload [])`가 앱마다 같은 이름 → 마지막 정의(prompts)가 decisions까지 덮음
2. **서버 hang**: `option-lines`의 `reduce`/`str-split`/`concat` 경로가 요청을 멈춤 → 이후 전 서버 응답 불가
3. **db row + obj-merge**: SQLite row는 JS 네이티브 객체라 `obj-merge`로 bounds를 합치면 키 유실
4. HMR은 `npm run dev`(SSE `:40851`) 전용. 포트는 `_app.fl`에 `40860` 고정이라 PM2와 동시 기동 불가

## 수정 (파일·변경 요약)
- `pages/decisions/api.flx` — `decisions-payload`, 날짜 키 명시 복사, 옵션 분리 서버 제거
- `pages/decisions/index.flx` — 선택지 칩 클릭, 날짜 필터, 터치 타깃/`font-size:16px`, Island에서 `option-list`
- `pages/decisions/_db.flx` — `date-bounds`
- `pages/prompts/{_db,api,index}.flx` — 새 앱 (`prompts-payload`), 홈 카드
- `pages/index.flx` — Prompts 카드
- `island-compiler.js` — `str_trim`, `str_split` Island 헬퍼

## 검증 (curl 명령)
```bash
curl -sS http://127.0.0.1:40860/decisions/api
# today / week_start / month_start / open_count 포함

curl -sS http://127.0.0.1:40860/prompts/api
# {"items":[...]} 만 (decisions 필드 없음)

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/decisions
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/prompts
```

HMR 실측 (`pm2 stop freelang-front` 후):
```bash
npm run dev
# SSE: curl -sSN http://127.0.0.1:40851/~hmr
# public/app.css 수정 → data: css-reload  (L2)
# pages/*.flx 로직 수정 → data: soft-reload (L3)
```

실측 결과: L2 `css-reload` · L3 `soft-reload` 이벤트 확인.

## PM2
```bash
pm2 stop freelang-front   # HMR 실측 시에만
# … npm run dev …
pm2 start freelang-front  # 복구
pm2 restart freelang-front --only freelang-front
```
