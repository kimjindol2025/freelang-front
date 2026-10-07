# FreeLang fl-front — 프론트엔드 프레임워크 비교

작성: 2026-06-02  
기준: Island E2E 검증 완료 후 (jsdom 11/11 통과)

---

## 포지셔닝 한 줄

> **Svelte 감성 + Astro 철학** 을 새 언어로 구현한 것.

SSR 중심, Island로 클라이언트 인터랙션 추가, 의존성 0.

---

## 검증된 기능 (2026-06-02 기준)

| 기능 | 상태 |
|------|------|
| SSR 렌더링 | ✅ 검증됨 |
| 라우팅 | ✅ 검증됨 |
| DB 연동 | ✅ 검증됨 |
| 인증/쿠키 | ✅ 검증됨 |
| Island 마운트 | ✅ 검증됨 |
| atom 로컬 상태 | ✅ jsdom 검증됨 |
| 글로벌 store | ✅ jsdom 검증됨 |
| Island 간 동기화 | ✅ jsdom 검증됨 |
| 실 브라우저 E2E | ⏳ 미검증 |

---

## Astro와 비교 — 가장 유사한 철학

| | FreeLang | Astro |
|-|---------|-------|
| 아키텍처 | SSR + Island | SSR + Island |
| 언어 | FL (Lisp 계열) | `.astro` (HTML 슈퍼셋) |
| Island 상태 관리 | atom / global store (자체) | React/Vue/Svelte 위임 |
| 생태계 | 없음 | npm 전체 |
| 학습 곡선 | 높음 (새 언어) | 낮음 (HTML 알면 됨) |
| 의존성 | 0 | 많음 |

**핵심 차이:** Astro는 Island 상태 관리를 외부 프레임워크에 위임한다.  
FreeLang은 `atom` / `dispatch` / `watch-store`를 자체 구현해서 의존성이 없다.

---

## HTMX와 비교 — 서버 중심 철학

| | FreeLang | HTMX |
|-|---------|------|
| 방식 | SSR + Island | SSR + 하이퍼미디어 |
| 클라이언트 JS | Island JS 생성 | 거의 없음 |
| 상태 관리 | atom / store | 서버가 전부 |
| 클릭 시 | 클라이언트 상태 변경 | 서버 요청 → HTML 수신 |

**핵심 차이:** HTMX는 클릭하면 서버에 요청을 보내서 HTML을 받아온다.  
FreeLang Island는 클라이언트에서 상태를 관리한다. 목적이 다름.

---

## Svelte와 비교 — 가장 닮은 감성

| | FreeLang | Svelte |
|-|---------|--------|
| 문법 간결함 | ✅ 매우 간결 | ✅ 매우 간결 |
| 컴파일 | Island JS 생성 | 컴포넌트 컴파일 |
| 반응성 | atom + swap | 변수 할당으로 반응 |
| 번들 크기 | 작음 | 작음 |
| 생태계 | 없음 | 있음 |

코드 비교:

```svelte
<!-- Svelte -->
<script>let n = 0;</script>
<button on:click={() => n++}>{n}</button>
```

```fl
; FreeLang
(island Counter []
  (let [n (atom 0)]
    (h "button" {:on-click (fn [] (swap! n inc))} (str @n))))
```

감성이 비슷하다. 둘 다 "적게 써도 동작한다"를 추구.

---

## React / Next.js와 비교

| | FreeLang | React/Next |
|-|---------|-----------|
| 언어 | FL | JS/TS |
| 번들 전략 | Island만 | 전체 앱 |
| 생태계 | 없음 | 방대함 |
| 타입 시스템 | 없음 | TypeScript |
| 상태 관리 | atom/store | useState/Redux/Zustand |
| 커뮤니티 | 1명 | 수백만 |

비교 자체가 무의미한 수준의 격차. React는 산업 표준.

---

## 적합한 사용처

| 사용처 | 적합도 |
|--------|--------|
| 블로그 / CMS | ✅ 적합 |
| 관리자 페이지 | ✅ 적합 |
| 대시보드 | ✅ 적합 |
| CRUD 앱 | ✅ 적합 |
| 복잡한 client-first SPA | ⚠️ 범위 밖 — SSR + Island SPA 이동은 지원 |
| 클라이언트 라우팅 앱 | ✅ SSR + Island 라우터 지원 |
| 실시간 협업 툴 | ⚠️ SSE/Island 조합은 지원, 고빈도 client-first 협업은 별도 검증 |

---

## 쓰는 이유

생태계 없음, 커뮤니티 없음, 프로덕션 레퍼런스 없음.

대신:
- 의존성 0
- 자체 완결
- **언어 자체를 고칠 수 있음**

쓰는 이유가 하나뿐이다 — 이 언어를 만드는 사람이 직접 쓰기 때문.

---

## 오늘 고친 것들 (Island 검증 과정에서 발견)

| 버그 | 원인 | 수정 커밋 |
|------|------|---------|
| Island div HTML에 없음 | PLACEHOLDER_N 패턴 불일치 | `472bda2` |
| 클릭해도 상태 0으로 리셋 | atom이 renderFn 안에서 재생성 | `40dbc86` |
| `counter_label is not defined` | CSS 바인딩 변수 미주입 | `40dbc86` |
