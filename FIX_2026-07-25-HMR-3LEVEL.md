# FIX — HMR 3단계 실제 동작 (2026-07-25)

## 목적지
핫리로드를 Next급 Fast Refresh가 아니라 **가능한 3단계**로 고정하고 실제로 동작하게 한다.

## 증상
- L1: SSE `reload`만 처리 (부분 구현)
- L2: 서버가 `css-reload`를내도 클라이언트가 무시
- L3: 없음 (풀 리로드만)

## 수정
- `pages/_layout.flx` HMR-SCRIPT: L1/L2/L3 핸들러
- `dev-server.js`: `(style)` 제거 로직 해시로 CSS-only 판별, `soft-reload` 기본
- `island-compiler.js`: `hmr_snapshot` / `hmr_register` / atom 복원
- `island-runner.js`: HMR 스텁 (테스트)
- `docs/HMR.md`

## 검증
- Island 테스트 11/11 PASS
- SSE 신호 `css-reload`+`soft-reload` 수신 OK
- 로직 해시: style만 변경 시 동일, render 변경 시 상이
