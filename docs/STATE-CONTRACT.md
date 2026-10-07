# FreeLang Front 상태·컴포넌트 계약

Front의 UI 상태는 세 종류로 나눈다.

| 종류 | 소유자 | 읽기 | 쓰기 | 범위 |
|---|---|---|---|---|
| SSR 상태 | 서버 요청·DB | `req`, DB helper | 서버 함수·API | 요청 한 번 |
| local atom | 하나의 Island | `@atom` | `swap!`, `reset!` | 해당 Island |
| global store | 페이지의 Island 런타임 | `get-store` | `dispatch` | 여러 Island |

## 규칙

- `atom`은 Island 최상위 `let`에서 만들고 렌더 함수 재실행 때 재생성하지 않는다.
- global store 키는 먼저 `(defstore :key initial)`로 선언한다.
- global store는 `(get-store "key")`와 `(dispatch "key" value)`를 사용한다.
- 여러 키를 한 번에 바꿀 때는 `(dispatch {"a" value-a "b" value-b})`를 쓴다.
  각 변경 키는 해당 `[:watch "key"]` Island에 개별 통지된다.
- `:watch`에는 선언된 store 키만 넣는다. 미선언 키는 빌드 진단 경고다.
- 컴포넌트 함수는 `pages/_ui.flx`에 두고 props를 인자로 받는다. 컴포넌트 안에
  전역 store를 숨기지 말고, 상태 소유 Island가 값을 넘긴다.

## 검증

```bash
node scripts/state-contract-gate.js --json
node island-runner.js pages/examples/34-state-contract.flx \
  --island=statewriter --click=button
```

첫 명령의 스키마는 `fl-state-contract/1`이다. 현재 fixture는 배치 dispatch 후
`state-message=updated`, `state-count=1`을 확인한다. 전체 빌드에서는 같은 fixture가
Island 회귀 테스트에 포함되며, 브라우저에서는 `StateReader`의 `initial → updated`
변화를 확인해야 한다.

HMR은 local atom과 global store snapshot을 보존하지만, SSR 상태를 브라우저
상태로 자동 승격하지 않는다. 서버 데이터와 client state의 경계를 유지한다.
