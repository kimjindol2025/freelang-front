# Front UI 컴포넌트 계약

7단계의 첫 계약이다. `_ui.flx`는 화면마다 임의의 HTML/CSS를 반복하는 파일이
아니라, AI가 조합할 수 있는 공통 컴포넌트 집합으로 취급한다.

검수:

```bash
node scripts/ui-contract-gate.js
```

계약 스키마는 `fl-ui-contract/1`이다.

| 그룹 | 기본 컴포넌트 |
|---|---|
| atoms | `ui-btn`, `ui-badge`, `ui-avatar`, `ui-divider`, `ui-spinner` |
| forms | `ui-input`, `ui-textarea`, `ui-select`, `ui-checkbox`, `ui-form-group` |
| layout | `ui-card`, `ui-grid`, `ui-stack`, `ui-row` |
| feedback | `ui-alert`, `ui-empty`, `ui-progress` |
| data | `ui-table`, `ui-stat`, `ui-tags` |

PASS는 함수 존재만 의미하지 않는다. 실제 화면에서 사용할 때는 Front 빌드,
SSR HTML, Island interaction, 접근성·반응형 검증을 함께 수행해야 한다.
