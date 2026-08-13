# fx 프론트 업그레이드 1차 마감: FL / fx2 native / fx2 WASM 실행 경로 정리 기록

작성일: 2026-08-12

이 글은 `freelang-front`에서 fx2 프론트 업그레이드 1차 마감을 끝내기까지의 실제 작업 기록이다. 목표는 세 경로를 한 화면에서 분리해 정리하고, 서버 73의 실제 Chrome smoke로 동작을 확인한 뒤 커밋과 푸시까지 마치는 것이었다.

최종 커밋은 `497e8e2dd079ce2350858f8faad8c0583a62ec28` 이고, `origin/master`로 푸시했다.

## 시작점

이미 다음 세 경로가 존재하는 상태에서 작업을 이어받았다.

- 기존 FL evaluator: `/api/playground/eval`
- fx2 native 검사: `/api/playground/fx2`
- fx2 WASM smoke: `/fx2-wasm/index.html`

초기 목표는 기능을 크게 바꾸지 않고, 각 경로가 제자리를 차지하도록 정리하는 것이었다.

## 실제로 바뀐 것

최종적으로 커밋된 수정은 두 파일이다.

- `pages/fx2-wasm/index.html.flx`
- `public/fx2-wasm/fx2-wasm.css`

핵심은 `/fx2-wasm/index.html`을 외부 JS/CSS 조합에 기대는 구조에서, 브라우저 smoke에 필요한 내용을 페이지 안에서 바로 실행 가능한 형태로 정리한 점이다. 이 페이지는:

- WASM 로드 상태
- 실행 성공/실패
- runtime
- input 상태
- stdout/result

를 화면에 보여준다.

기존 FL evaluator와 fx2 native 경로는 유지했다. 전체 사이트 CSP도 느슨하게 풀지 않았다.

## 무엇이 실패했고, 어떻게 고쳤는가

처음에는 `/fx2-wasm` 아래 정적 파일을 따로 서빙하는 방식으로 붙였다. 그런데 실제 서버 73 Chrome smoke에서 다음 문제가 반복됐다.

- inline style blocked by CSP
- inline script blocked by CSP
- `WebAssembly.instantiateStreaming` / `instantiate` blocked by CSP
- 정적 JS/CSS/WASM가 404로 떨어짐

이 과정에서 두 가지를 확인했다.

첫째, CSP 문제는 `/fx2-wasm/index.html`에만 범위를 좁혀 처리해야 했다.

둘째, 정적 자산 경로는 기대대로 흘러가지 않았다. 그래서 최종적으로는 페이지를 self-contained 형태로 정리해, 브라우저 smoke가 외부 자산에 덜 의존하도록 만들었다.

최종 smoke 기준에서는 WASM/CSP 관련 콘솔 에러가 사라졌다.

남아 있던 `40851/~errors` 연결 실패와 404는 이번 마감 범위에서 건드리지 않았다.

## 검증

서버 73의 실제 Chrome + puppeteer-core로 다음을 다시 확인했다.

- 기존 FL `/api/playground/eval` PASS
- fx2 native `/api/playground/fx2` PASS
- `/fx2-wasm/index.html` PASS
- Playground의 fx2 WASM iframe PASS

최종 smoke 결과에서 브라우저는 다음 메시지를 실제로 출력했다.

```text
fx2 WASM browser smoke passed
```

실행 상태도 확인됐다.

- WASM load success
- 실행 성공
- runtime 표시

## 마무리 정리

작업이 끝난 뒤 임시 파일도 정리했다.

- `public/fx2-wasm/fx2-wasm-page.js`는 예전 구현의 잔재였고, 최종 경로와 중복되어 삭제했다.

최종적으로 작업 디렉터리는 clean 상태로 맞췄다.

## 남은 제한

이번 마감에서 남겨둔 항목은 명확하다.

- `127.0.0.1:40851/~errors` 연결 실패 원인 별도 추적
- `404`의 세부 원인 별도 분리
- WASM 외 추가 기능 확장 없음

즉, 이번 글의 범위는 “fx 프론트 1차 마감”이다. 네이티브와 WASM smoke가 둘 다 실제 Chrome에서 통과하는 상태까지를 확인했고, 그 이상은 다음 작업으로 넘겼다.
