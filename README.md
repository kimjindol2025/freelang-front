# freelang-front

> FreeLang v11 `.flx` 기반 풀스택 프론트엔드 프레임워크  
> **npm install 0개** — Next.js + Tailwind + Zustand + TanStack 스택 전체 대체

---

## 한 줄 요약

`.flx` 파일 하나로 라우트·SSR·CSS DSL·상태관리·실시간 통신을 처리하는 FreeLang 전용 프론트엔드 런타임.  
외부 의존성 없이 다수의 내장 앱, SSE 실시간 알림, 성능 모니터링까지 프로덕션 검증 완료.

---

## 현재 상태

| 항목 | 값 |
|------|-----|
| 버전 | **1.0.0** (2026-06-02 프로덕션 릴리즈) |
| 운영 기간 | 10일+ 연속 안정 운영 |
| pages/ | 파일 31개 + 디렉토리 17개 |
| 코드량 | 2,000줄+ |
| 포트 | 앱 **40860** / 개발서버 HMR **40851** |
| 메모리 | 안정 (< 100MB) |
| 응답시간 | < 200ms |

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

### 6. 내장 유틸리티 (`_*.flx`)
| 파일 | 역할 |
|------|------|
| `_layout.flx` | 공통 레이아웃 |
| `_ui.flx` | UI 컴포넌트 |
| `_auth.flx` | 인증 |
| `_db.flx` | DB 접근 |
| `_oauth.flx` | OAuth |
| `_payment.flx` | 결제 |
| `_storage.flx` | 파일 스토리지 |
| `_email.flx` | 이메일 |
| `_charts.flx` | 차트 |

---

## 프로젝트 구조

```
freelang-front/
├── pages/              ← 라우트 (.flx)
│   ├── index.flx       → GET /
│   ├── [id].flx        → GET /:id
│   ├── api/            → API 엔드포인트
│   └── _*.flx          → 전역 유틸리티
├── stdlib/             ← 내장 표준 라이브러리
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
PORT=40860 node /home/kim/바탕화면/kim/freelang-v11/bootstrap.js run server.fl

# 개발 (파일 감시 + HMR, 포트 40851)
node dev-server.js
```

**빌드** (헬퍼 함수 스캔 → `_app.fl` 생성):
```bash
node fl-front-build.js         # 일반 빌드
node fl-front-build.js --json  # JSON 출력 (AI 파이프라인용)
```

**AI 컨텍스트 엔드포인트** (dev-server 실행 중):
```bash
GET http://localhost:40851/~ai          # 전체 AI 컨텍스트
GET http://localhost:40851/~ai/test     # Island headless HTTP 테스트
```

---

## 빠른 시작

```flx
; pages/hello.flx
(page "/hello"
  (h1 "안녕하세요")
  (p "FreeLang Front 첫 페이지"))
```

저장하면 `GET /hello` 라우트 자동 등록.

---

## Phase 로드맵

| Phase | 내용 | 난이도 | 상태 |
|-------|------|--------|------|
| P1 | 파일 라우터 + SSR + dev-server | ★★☆ | ✅ 완료 |
| P2 | CSS DSL + 빌드 파이프라인 | ★★☆ | ✅ 완료 |
| P3 | 아일랜드 컴파일러 | ★★★★★ | ✅ 완료 |
| P4 | query / form / atom 내장 | ★★★☆ | ✅ 완료 |
| P5 | SVG 차트 + HMR | ★★★☆ | ✅ 완료 |

---

## 적합한 사용 사례

- 콘텐츠 중심 앱 (블로그, 문서, 뉴스)
- 관리자 대시보드
- SaaS 프론트엔드

**범위 밖**: 3D·게임·전체 화면을 client-first로 운영하는 대형 SPA.
SSR + Island 기반의 일반적인 SPA 이동과 인터랙션은 지원한다.

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
| `CHANGELOG.md` | 버전별 변경 이력 |

---

## 저장소

```
https://gogs.dclub.kr/kim/freelang-front.git
```
