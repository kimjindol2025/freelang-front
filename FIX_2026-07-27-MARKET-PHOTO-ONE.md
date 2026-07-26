# FIX — Market Photo One (2026-07-27)

## 증상

- Market v1은 `photo_url` 텍스트 입력만 지원 — 실제 업로드·썸네일 없음

## 구현

- `pages/market/_db.flx` — `save-photo-data-url` (base64 data URL → `public/uploads/market/`, 2MB 제한)
- `pages/market/api.flx` — `upload-photo` action
- `pages/market/index.flx` — file input + 미리보기 + URL fallback
- `server.fl` — `(server-static "public/uploads/market" "/uploads/market")` + **`npm start`는 `server.fl` 진입** (`_app.fl` 직접 실행 시 static 미등록 → img 404)

## 검증

```bash
node fl-front-build.js --json
# → ok true, errors []

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/market
# → 200

curl -sS -X POST http://127.0.0.1:40860/market/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"upload-photo","data_url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}'
# → {"ok":true,"url":"/uploads/market/m971645.png"}

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/uploads/market/m971645.png
# → 200
```

## 함정

- Island upload-photo 중첩 fn → 괄호 지옥. **on-dataurl / on-photo-uploaded 분리** 필수.
- `read-file-dataurl!` — island-compiler에 emit 추가 없으면 컴파일 실패.
- **`npm start`가 `_app.fl` 직접 실행** → `server.fl`의 `server-static` 미등록 → 업로드 URL 404. **진입점은 `server.fl`**.

## PM2

```bash
pm2 restart freelang-front
```
