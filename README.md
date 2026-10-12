# FreeLang Front

> AI가 안전하게 화면·데이터·권한·검수를 만들도록 설계한 FreeLang v11 `.flx` 기반 프론트 언어.

사람 개발자용 범용 생태계를 복제하는 프로젝트가 아닙니다. AI가 작업 의도를
capability로 선택하고, 계약을 확인하고, 실제 실행 검수까지 반복하는 내부 개발
플랫폼입니다.

---

## 한 줄 요약

`.flx` 하나로 라우팅·SSR·API·Island UI·상태·실시간 통신을 작성하고, JS는
선언된 브라우저 bridge 경계에만 둡니다. 목표는 AI가 추측하지 않고 계약과 실행
증거로 개발하는 것입니다.

---

## 현재 상태

| 항목 | 값 |
|------|-----|
| 상태 | 내부 운영 기준 검증 중 |
| 운영 기간 | 10일+ 연속 안정 운영 |
| pages/ | 파일 31개 + 디렉토리 17개 |
| 코드량 | 2,000줄+ |
| 포트 | 앱 **40860** / 개발서버 HMR **40851** |
| 메모리 기준 | 운영 Node 힙 256MB 상한 · 내부 gate RSS < 512MB |
| 응답시간 기준 | API p95 < 50ms · SSR p95 < 120ms |

현재 기준 커밋은 Git history와 release gate 결과를 기준으로 판단합니다. README의
설명만으로 상용·외부 공개 완료를 주장하지 않습니다.

---

## 주요 기능

### 1. 파일 기반 라우터
```
pages/index.flx        → GET /
pages/about.flx        → GET /about
pages/users/[id].flx   → GET /users/:id
pages/api/hello.flx    → GET /api/hello
```
`pages/` 디렉토리 구조가 곧 라우트. `[param]` 패턴으로 동적 라우트 지원.

### 2. CSS DSL
별도 파일 없이 `.flx` 안에서 스타일 선언. `_styles.flx`로 전역 테마 관리.

### 3. 아일랜드 컴파일러 (P3)
페이지 전체 SSR + 인터랙티브 영역만 선택적 하이드레이션.

### 4. 실시간 알림 (SSE)
- 폴링 대비 트래픽 99% 감소
- 임계값 기반 자동 감지 및 알림 발송

### 5. 성능 모니터링 내장
`page-load`, `api-call`, `route-transition`, `long-task`, `memory` 5가지 메트릭 자동 수집.  
SLO/SLA 자동 추적 및 준수율 실시간 계산.

### 6. AI capability와 표준 라이브러리

AI가 먼저 `ai-capabilities.json`을 조회해 작업을 분류합니다.

| capability | 역할 | 상태 |
|---|---|---|
| `ui` | 화면·폼·테이블·피드백 | stable |
| `data` | SQLite·AFJ-DB95·CRUD | stable |
| `auth` | 세션·로그인·보호 라우트 | guarded |
| `test` | assertion·회귀 결과 | stable |
| `schema` | 필수 입력·payload 계약 | stable |
| `fixture` | 결정적 seed/reset/snapshot | stable |

AI 흐름:

```text
작업 의도 → capability 선택 → 입력/출력/권한 확인
→ .flx 생성 → targeted test → 전체 release gate
```

```bash
npm run ai:capabilities
npm run libraries:contract
```

### 7. 내부 헬퍼 (`pages/_*.flx`)
| 파일 | 역할 |
|------|------|
| `_layout.flx` | 공통 레이아웃 |
| `_ui.flx` | UI 컴포넌트 |
| `_auth.flx` | 인증 |
| `_db.flx` | DB 접근 |
| `_oauth.flx` | OAuth |
| `_storage.flx` | 파일 스토리지 |
| `_email.flx` | 이메일 |
| `_charts.flx` | 차트 |

`payment`, `email`, `i18n`은 AI가 안전하게 선택할 provider·실행 fixture가
부족해 보류 상태입니다. 사용 근거 없이 라이브러리 수를 늘리지 않습니다.

---

## 프로젝트 구조

```
freelang-front/
├── pages/              ← 라우트 (.flx)
│   ├── index.flx       → GET /
│   ├── [id].flx        → GET /:id
│   ├── api/            → API 엔드포인트
│   └── _*.flx          → 전역 유틸리티
├── stdlib/             ← AI 표준 라이브러리 (schema/fixture/test)
├── ai-capabilities.json← AI capability 선택 계약
├── runtime/            ← 런타임 코어
├── public/             ← 정적 파일
├── server.fl           ← 메인 서버 진입점
├── router.fl           ← 라우트 스캐너
├── island-compiler.js  ← 아일랜드 컴파일러
├── style-compiler.js   ← CSS DSL 컴파일러
├── dev-server.js       ← 개발 서버 (HMR)
├── fl-front.config.flx ← 설정 파일
└── SPEC.airc           ← AI 협업 설계 문서
```

---

## 실행

```bash
# 프로덕션 (기본 포트 40860, `PORT`로 변경 가능)
PORT=40860 NODE_OPTIONS=--max-old-space-size=256 \
  node runtime/bootstrap.js run server.fl

# 개발 (파일 감시 + HMR, 포트 40851)
node dev-server.js
```

**빌드** (헬퍼 함수 스캔 → `_app.fl` 생성):
```bash
node fl-front-build.js         # 일반 빌드
node fl-front-build.js --json  # JSON 출력 (AI 파이프라인용)
npm run ai:capabilities       # AI capability 계약
npm run libraries:contract    # 표준 라이브러리 실제 실행 계약
npm run perf:contract         # 성능·동시성·200회 안정성 계약
npm run verify:internal       # 전체 내부 release gate
```

**AI 컨텍스트 엔드포인트** (dev-server 실행 중):
```bash
GET http://localhost:40851/~ai          # 전체 AI 컨텍스트
GET http://localhost:40851/~ai/test     # Island headless HTTP 테스트
```

---

## AI 작성 예시

```flx
; pages/hello.flx
(page "/hello"
  (h1 "안녕하세요")
  (p "FreeLang Front 첫 페이지"))
```

AI는 먼저 capability 계약을 확인한 뒤 `.flx`를 작성합니다. 저장하면
`GET /hello` 라우트가 등록됩니다.

---

## 검증된 범위

| Phase | 내용 | 난이도 | 상태 |
|-------|------|--------|------|
| 영역 | 검증 |
|---|---|
| build/diagnostics | 153 routes, 0 errors |
| AI capability | 6개 capability 선택 계약 PASS |
| library contract | schema/fixture 실제 FreeLang 실행 PASS |
| runtime | API·SSR·Island·SSE·다중 인스턴스 PASS |
| performance | 256MB heap, API 200회 오류 0건 |

전체 검수 명령은 실패 항목을 숨기지 않습니다. 외부 `freelang-tools` 환경이나
사용자 dirty 변경으로 막힌 항목은 `BLOCKED`로 남깁니다.

---

## 적합한 사용 사례

- 콘텐츠 중심 앱 (블로그, 문서, 뉴스)
- 관리자 대시보드
- SaaS 프론트엔드

**범위 밖**: 3D·게임·전체 화면을 client-first로 운영하는 대형 SPA.
SSR + Island 기반의 일반적인 SPA 이동과 인터랙션은 지원한다.

### 다중 인스턴스 검증

제품 서버는 `PORT` 환경변수로 격리할 수 있다. 릴리즈 게이트는 같은 `.flx`
제품을 두 개의 임시 포트에서 동시에 실행하고 API·SSR·Island·event-stream
예제 라우트를 각각 확인한다.

```bash
npm run multi:contract
```

성능 계약은 운영과 같은 256MB Node 힙 상한의 임시 실제 런타임에서 API·SSR·Island,
API 200회 연속 요청과 20개 동시 요청을 측정하고,
기준 미달이면 release gate를 실패시킨다.

```bash
npm run perf:contract
```

---

## 내장 앱 (pages/)

| 앱 | 경로 | 설명 |
|----|------|------|
| 대시보드 | `/dashboard` | 메인 허브 |
| 노트 | `/notes` | Island SSR 메모 |
| 할 일 | `/todo` | 할일 관리 |
| 연락처 CRM | `/contacts` | 인맥 관리 + 활동 기록 + 연락주기 알림 |
| 비밀번호 금고 | `/vault` | envelope 암호화 기반 자격증명 저장 |
| 파일 | `/files` | 파일 업로드/관리 |
| 사진 | `/photos` | 사진 갤러리 |
| 독서 | `/reading` | 독서 기록 |
| 건강 | `/health` | 건강 추적 |
| 피드 | `/feed` | 뉴스/콘텐츠 피드 |
| 구독 | `/subs` | 구독 관리 |
| 목표 | `/goals` | 목표 추적 |
| 쇼핑 | `/shop` | 쇼핑 리스트 |
| 플래시카드 | `/flash` | 학습용 카드 |
| 예제 | `/examples/` | 30개 학습용 예제 |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| `AGENTS.md` | **AI 세션 시작 시 필독** — 주입 헬퍼 함수 전체 목록 (자동 생성) |
| `SPEC.airc` | 설계 명세 + 진행 중 태스크 (`hot` 필드) |
| `SYNTAX.airc` | `.flx` 문법 레퍼런스 |
| `HELPERS.airc` | 헬퍼 API + v11 신규 함수 |
| `HANDOFF.airc` | AI 인계 문서 (경로·포트·완료 작업 목록) |
| `ai-capabilities.json` | AI capability 선택·권한·실패·검증 계약 |
| `docs/FREELANG-FRONT-LIBRARIES.md` | 표준 라이브러리와 보류 기준 |
| `CHANGELOG.md` | 버전별 변경 이력 |

---

## 저장소

```
https://gogs.dclub.kr/kim/freelang-front.git
```
