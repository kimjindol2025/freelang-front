# FreeLang Browser Tab Observability

이 문서는 FreeLang 프론트 검증에서 **Chrome 전체가 아니라 사용자가 지정한 단일 탭만** 감시하는 표준을 정의한다.

## 목적

- 서버 curl PASS와 실제 프론트 오류를 분리한다.
- AI가 사용자가 지정한 탭의 console, network, DOM, screenshot, interaction 결과만 읽게 한다.
- 다른 탭의 잡음을 섞지 않는다.

## 운영 모델

1. 사용자가 Chrome에서 감시할 탭을 지정한다.
2. FreeLang은 그 탭을 `tab_id`로 고정한다.
3. 이후 모든 브라우저 검증은 그 탭만 대상으로 수행한다.
4. AI는 해당 탭의 결과를 읽고 수정 후 같은 탭을 다시 검증한다.

## 표준 명령

```text
node fl-browser.js attach
node fl-browser.js watch active
node fl-browser.js check active
node fl-browser.js logs active
node fl-browser.js screenshot active
node fl-browser.js start

# CDP 브라우저가 실행 중일 때 대표 SPA 상호작용 계약
npm run browser:contract
```

## 탭 식별 규칙

- 기본 식별자: `tab_id`
- 보조 식별자: `url`
- 최종 검증 대상: `tab_id`
- 같은 URL의 다른 탭은 무시한다.
- SPA 라우팅 중에도 동일 `tab_id`를 유지한다.

## 표준 결과

```yaml
browser:
  target: tab
  tab_id: 17
  url: /roadmap
  load: PASS
  console_errors: 0
  network_errors: 0
  dom: PASS
  interactions: PASS
  screenshot: PASS
result: PASS
```

## Contract 필드

브라우저 탭 감시는 AI Contract에 다음 필드로 기록한다.

- `checks.browser.load`
- `checks.browser.console`
- `checks.browser.network`
- `checks.browser.dom`
- `checks.browser.interactions`
- `checks.browser.screenshot`
- `checks.browser.result`
- `browser.target`
- `browser.tab_id`
- `browser.url`

## 판정 규칙

- `load` 실패는 즉시 `FAIL`
- `console_errors > 0` 이면 `FAIL`
- `network_errors > 0` 이면 `FAIL`
- 핵심 DOM 미존재는 `FAIL`
- 상호작용 실패는 `FAIL`
- 스크린샷 생성 실패는 `FAIL`
- 위 항목이 모두 통과해야 `PASS`

## 구현 훅

- `fl-browser.js`가 로컬 브라우저 CLI와 상태 파일(`.browser-state.json`)을 관리한다.
- `browser:contract`는 People 로드 → Market SPA 이동 → 글쓰기 폼 표시를 한 탭에서
  실행하며, 각 단계의 console/network/DOM/screenshot 결과를 확인한다. CDP가
  없으면 `BLOCKED`로 남긴다. 운영 PM2에서 정상적으로 발생하는 `/~hmr-state`
  404와 전환 중 `ERR_ABORTED`만 명시적 노이즈로 제외하며, 다른 4xx/5xx와
  네트워크 오류는 계속 FAIL이다.
- `dev-server.js`의 HMR/AI 포트(40851)가 `/~ai/browser`와 `/~ai/contracts`에서 브라우저 상태를 읽는다.
- `/roadmap`는 브라우저 readiness를 요약 라인으로 반영한다.

## 대시보드 반영

- `/~ai/contracts`는 탭 기반 브라우저 판정 요약을 노출한다.
- `/roadmap`는 해당 결과를 readiness 카드에 반영한다.
- `last_verified.commit`은 브라우저 검증이 끝난 기준 커밋으로 기록한다.

## 설계 원칙

- Chrome 전체를 보지 않는다.
- 사용자가 지정한 탭만 본다.
- 다른 탭의 로그는 절대 섞지 않는다.
- 검증 실패 시 AI는 같은 탭으로 다시 확인한다.
