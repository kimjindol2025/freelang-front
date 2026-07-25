# FIX — freelang-front Island fetch 무한루프 (2026-07-25)

## 증상
- `/people` 콘솔: `GET /people/api` · `POST /api/metrics` · `POST /api/errors` **429** 폭주
- `GET :40851/~hmr` · `POST :40851/~errors` → `ERR_CONNECTION_REFUSED` (PM2)
- `[circuit] open — 모니터링 일시 중단`

## 원인
1. Island 본문의 `(fetch! … (fn [res] (reset! data res)))` 가 **매 `update()`마다** 실행됨. `reset!` → `update()` → 다시 `fetch!` → 무한루프 → rate limit 429.
2. `when` 컴파일러가 body를 **한 식만** 받아 `(when test (reset! …) (fetch! …))` 의 `fetch!`가 버려질 수 있었음.
3. Island `_err`가 localhost에서 `:40851/~errors`로 POST → PM2에 HMR 서버 없으면 연결 거부 스팸.
4. HMR이 probe 없이 `EventSource`를 열어 실패 로그가 남음.

## 수정 (파일·변경 요약)
| 파일 | 변경 |
|------|------|
| `pages/people/index.flx` | `loaded` atom + `(when (not @loaded) … fetch!)` |
| `pages/decisions/index.flx` | 동일 |
| `pages/prompts/index.flx` | 동일 |
| `island-compiler.js` | `when` 다중 body → `do`; `_err`에서 `:40851` POST 제거 |
| `pages/_layout.flx` | HMR: `GET :40851/~errors` probe 성공 시에만 EventSource |

## 검증 (curl 명령)
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:40860/people
curl -s http://localhost:40860/people/api | head -c 200
# 연속 호출해도 429이 아니어야 함
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code} " http://localhost:40860/people/api; done; echo
```

## PM2
```bash
node fl-front-build.js
pm2 restart freelang-front --update-env
```

브라우저: `/people` **하드 리프레시** 후 Network에서 `/people/api` 가 마운트 시 **1회**만인지 확인.
