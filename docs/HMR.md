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

## 구현 파일
- `dev-server.js` — 감시·신호
- `pages/_layout.flx` `HMR-SCRIPT` — 클라이언트
- `island-compiler.js` — `hmr_snapshot` / `hmr_register` / atom 복원
