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
fl browser attach
fl browser watch active
fl browser check active
fl browser logs active
fl browser screenshot active
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

## 대시보드 반영

- `/~ai/contracts`는 탭 기반 브라우저 판정 요약을 노출한다.
- `/roadmap`는 해당 결과를 readiness 카드에 반영한다.
- `last_verified.commit`은 브라우저 검증이 끝난 기준 커밋으로 기록한다.

## 설계 원칙

- Chrome 전체를 보지 않는다.
- 사용자가 지정한 탭만 본다.
- 다른 탭의 로그는 절대 섞지 않는다.
- 검증 실패 시 AI는 같은 탭으로 다시 확인한다.
