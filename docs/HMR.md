# HMR 3단계 (dev-server)

`npm run dev` → SSE `http://localhost:40851/~hmr`

| 단계 | 신호 | 동작 |
|------|------|------|
| L1 | `reload` | `location.reload()` 전체 새로고침 |
| L2 | `css-reload` | HTML의 `<style>`/`<link stylesheet>`만 갱신 (서버 재시작 없음) |
| L3 | `soft-reload` | store·island atom 스냅샷 → HTML 재수신 → 복원 |

## 판별
- **L2**: `(style …)` 제거 후 로직 해시 동일, 또는 `public/app.css` / `style-compiler.js` 변경
- **L3**: `.flx` 로직 변경 → 빌드 + 서버 재시작 + `soft-reload`
- soft 실패 시 클라이언트가 L1으로 폴백

## 실행 계약

- 운영: `ecosystem.config.js`의 `runtime/bootstrap.js run server.fl` → `:40860`
- 개발: `npm run dev` → 앱 `:40860` + HMR/AI 서버 `:40851`
- 개발 서버는 재시작 로그만 기다리지 않고 앱 포트가 HTTP 응답 가능한 상태가 된 뒤 HMR 신호를 보낸다.
- 운영 PM2와 개발 서버는 같은 앱 포트를 사용하므로 동시에 실행하지 않는다.

## 검증

```bash
node --check dev-server.js
pm2 startOrRestart ecosystem.config.js --only freelang-front
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:40860/front
```

브라우저 자동 갱신은 `npm run dev`에서 확인한다. `:40851`을 차단하는 프록시·브라우저 정책이 있으면 HMR 브라우저 검증은 BLOCKED로 기록하고, 앱 HTTP·빌드·개발 서버 기동 검증과 분리한다.

## 구현 파일
- `dev-server.js` — 감시·신호
- `pages/_layout.flx` `HMR-SCRIPT` — 클라이언트
- `island-compiler.js` — `hmr_snapshot` / `hmr_register` / atom 복원
