# HMR 3단계 (dev-server)

`npm run dev` → 앱 origin의 `GET /~hmr-state` 폴링 브리지

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
- 개발: `npm run dev` → 앱 `:40860` + 보조 HMR/AI 서버 `:40851`
- 브라우저 HMR은 앱과 같은 origin의 `:40860/~hmr-state`를 사용한다. 따라서
  브라우저 정책이나 프록시가 `:40851`을 차단해도 앱 origin 기반 HMR 검증은 가능하다.
- `:40851`은 개발 서버의 기존 SSE/AI 보조 엔드포인트이며 브라우저의 필수 경로가 아니다.
- 개발 서버는 재시작 로그만 기다리지 않고 앱 포트가 HTTP 응답 가능한 상태가 된 뒤 HMR 신호를 보낸다.
- 검수: `npm run hmr:contract`가 격리된 앱/HMR 포트에서 CSS reload와 실제 `.flx` 변경 후 soft reload를 확인한다.
- HMR 보조 포트는 `HMR_PORT`로 덮어쓸 수 있으며, 앱 origin 브리지는 개발 서버의 JSON 상태 endpoint를 사용한다.
- 브라우저 오류는 `console.error`/`console.warn`/`window.onerror`/unhandled rejection을 수집한다. `Error.stack`을 보존해 오류창에 `source:line:column`을 표시한다.
- 빌드 문법 오류는 서버를 재시작하지 않고 `build-error` 신호로 오류창에 전달한다. 수정된 빌드가 다시 성공하면 해당 오류가 자동으로 사라진다.
- soft reload는 Island store/atom뿐 아니라 일반 form 값·checkbox·focus·scroll 위치도 개발 세션에서 복원한다. password/file 입력값은 보안상 저장하지 않는다.
- 운영 PM2와 개발 서버는 같은 앱 포트를 사용하므로 동시에 실행하지 않는다.

## 검증

```bash
node --check dev-server.js
pm2 startOrRestart ecosystem.config.js --only freelang-front
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:40860/front
```

브라우저 자동 갱신은 `npm run dev`에서 확인한다. 개발 모드가 아닌 운영 PM2에서는
`/~hmr-state`가 `404`를 반환하며 HMR 브리지가 비활성화된다.

## 구현 파일
- `dev-server.js` — 감시·신호
- `pages/_layout.flx` `HMR-SCRIPT` — same-origin 클라이언트 폴링
- `server.fl` `dev-hmr-state` — 개발 전용 상태 브리지
- `island-compiler.js` — `hmr_snapshot` / `hmr_register` / atom 복원
- `pages/_layout.flx` `ERROR-OVERLAY`/`ERROR-COLLECTOR` — 콘솔 오류와 코드 위치 표시
