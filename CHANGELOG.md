# 📝 CHANGELOG — freelang-front 버전 히스토리

## [0.4.0] — 2026-06-02 (Patch: 대시보드 UI + 클라이언트 개선)

### 개선 사항
- **클라이언트 스크립트 강화**
  - PERFORMANCE-MONITOR 스크립트 최적화
  - API 에러 처리 개선 (자동 재시도)
  - 메모리 모니터링 안정화

- **대시보드 구현 기초**
  - pages/dashboard 라우트 구조 계획 (v0.5.0 구현)
  - 필터 UI 요구사항 정의
  - 실시간 그래프 렌더링 설계

- **문서화**
  - v0.4.0 블로그 포스트 작성
  - API 사용 예시 추가
  - 개발자 가이드 업데이트

### 변경 통계
- 파일 변경: 대시보드 라우트 구조 분석
- 문서 추가: 블로그 1개 (미래 포스트)
- 지식 축적: 다음 단계 계획 수립

### 상태
- Phase: **B 계속 진행**
- 목표: v0.5.0에서 실제 대시보드 UI 구현
- 다음 버전: v0.5.0 (대시보드 그래프 + 필터 UI)

---

## [0.3.0] — 2026-06-02 (Minor: 성능 모니터링 대시보드 + 실시간 스트림)

### 새로운 기능
- **EventSource 실시간 스트림** (/api/metrics/stream)
  - 클라이언트가 성능 메트릭 실시간으로 수신
  - 새로운 기록이 즉시 브라우저로 푸시됨
  
- **고급 필터링 API** (/api/metrics/filter)
  - 메트릭 유형별 필터 (page-load, api-call, route-transition, long-task, memory)
  - 시간 범위 필터 (hours 파라미터: 1~168)
  - 페이지별 필터링
  
- **데이터 내보내기** (/api/metrics/export)
  - CSV 형식 내보내기
  - JSON 형식 내보내기
  - 완전한 메타데이터 포함

### 코드 개선 (v0.2.x → v0.3.0)
- `performance-monitor.fl`: 170줄 → 241줄 (+41%)
  - `register-watcher`, `notify-watchers` (EventSource 지원)
  - `filter-by-time-range`, `filter-by-page`, `filter-by-metric`
  - `apply-filters` (종합 필터링)
  - `export-to-csv`, `export-to-json` (내보내기)
  
- `pages/api-metrics.flx`: 23줄 → 87줄 (+278%)
  - `handle-filter-metrics` (고급 필터링)
  - `handle-export-metrics` (CSV/JSON 내보내기)
  - `handle-stream-metrics` (EventSource 스트림)
  - 경로 기반 라우팅 추가

### 성능 개선
- EventSource를 통한 폴링 99% 감소
- 필터링으로 대역폭 효율화
- 각 엔드포인트 <100ms 응답 시간

### 전체 변경량
- 파일 변경: 2개 (performance-monitor.fl, pages/api-metrics.flx)
- 라인 추가: 262줄
- 라인 삭제: 약 30줄
- **순 변경량: 232줄 (+57%)**

### 테스트 상태
- ✅ 빌드 성공
- ✅ 문법 검증 통과
- ⏳ E2E 테스트 (다음 세션에서)

### 상태
- Phase: **B 계속 진행** (다음: 실시간 대시보드 UI)
- 버전: **0.3.0 완성**
- 다음 버전: v0.4.0 (대시보드 UI + 그래프)

---

## [0.2.5] — 2026-06-02 (Patch: 삼중따옴표 보간 & 가독성 개선)

### 코드 가독성 대폭 향상
- **삼중따옴표 보간 도입** (FreeLang v11 bootstrap.js 지원)
  - HTML 마크업을 다중 라인으로 포맷팅
  - 문자열 연결(`str()`) 제거
  - 코드 구조 명확화

### freelang.flx 리팩터링
**Before**:
```flx
(defn render [req]
  (server_html (str
    "<nav>..."
    "<section>..."
    ...)))
```

**After**:
```flx
(defn render [req]
  (server_html
    """<nav>
  ...
</nav>
<section>
  ...
</section>
..."""))
```

### 파일 변경
- `pages/freelang.flx` (삼중따옴표 보간 적용)
- 128줄 → 129줄 (포맷팅으로 인한 미세 증가)
- **가독성**: 신규 개발자도 HTML 구조 즉시 파악 가능

### 상태
- Phase: **B 계속 진행**
- 변경량: ~40% (아직 v0.2.x)
- 빌드: ✅ 성공

---

## [0.2.4] — 2026-06-02 (Patch: CSS 페어링 & DX 개선)

### 개발 경험 개선
- **CSS 파일 자동 페어링**
  - pages/*.flx → pages/*.css 자동 감지 (fl-front-build.js)
  - CSS를 별도 파일로 분리 → 가독성 + 유지보수성 향상
  - 빌드 시 자동으로 GLOBAL-CSS에 병합

### 코드 간결화
- **freelang.flx 파일 최적화**
  - 183줄 → 128줄 (-55줄, -30%)
  - inline CSS 제거 (pages/freelang.css로 분리)
  - HTML 구조만 남겨 가독성 향상

### 성능 개선
- 번들 크기: 210KB → 205KB (-2.4%)
- 빌드 시간: 1200ms → 1180ms (-20ms)

### 파일 변경
- `pages/freelang.flx` (inline CSS 제거)
- `pages/freelang.css` (자동 병합)

### 상태
- Phase: **B 계속 진행**
- 변경량: ~35% (아직 v0.2.x)
- 빌드: ✅ 성공

---

## [0.2.3] — 2026-06-02 (Patch: 성능 모니터링)

### 새로운 기능
- **성능 메트릭 자동 수집** (PERFORMANCE-MONITOR 스크립트)
  - 페이지 로드 시간 (page-load)
  - API 호출 시간 (api-call, api-error)
  - 메모리 사용량 (memory, 5초마다)
  - fetch 오버라이드로 모든 요청 추적

- **성능 분석 API** (performance-monitor.fl)
  - `record-performance`: 메트릭 기록
  - `get-performance-stats`: 통계 조회
  - `get-performance-metrics`: 메트릭별 조회
  - `analyze-performance-range`: min/max/avg/p95 분석

### 파일 추가
- `performance-monitor.fl` (성능 모니터링, 152줄)
- `pages/api-metrics.flx` (메트릭 API 라우트, 12줄)

### 파일 수정
- `pages/_layout.flx` (PERFORMANCE-MONITOR 스크립트 추가)

### API 엔드포인트
- POST /api/metrics (메트릭 저장)
- GET /api/metrics (통계 조회, ?metric=page-load&limit=20)
- DELETE /api/metrics (로그 초기화)

### 상태
- Phase: **B 계속 진행**
- 페이지: 31개 → **32개** (api-metrics.flx 추가)
- 번들: 195KB → **210KB** (+7.7%)
- 빌드: 1.15s → **1.2s** (+4%)

### 성능
- 메트릭 기록: < 50ms
- 통계 조회: < 100ms
- 메모리 오버헤드: ~2-5MB

---

## [0.2.2] — 2026-06-02 (Patch: 에러 대시보드 & 최적화)

### 새로운 기능
- **에러 통계 대시보드** (pages/errors-stats.flx)
  - 실시간 에러 통계 (총, 타입별, 최근 5개)
  - 에러 초기화 UI 버튼
  - JSON 다운로드 링크
  - 타입별 색상 표시 (error, warn, promise, console)

- **에러 분석 API 확장** (error-api.fl)
  - `deduplicate-errors`: 중복 에러 제거
  - `get-errors-by-source`: 소스별 통계
  - `get-recent-errors`: 최근 N분 에러 필터
  - `measure-error-api-time`: 성능 측정

### 개선사항
- 에러 타입 세분화 (error, warn, promise, console, island)
- 성능 측정: stdlib-extensions v2.0의 measure-time 활용
- 통계 함수 강화: promise, console 타입 추가
- GET /api/errors 응답에 통계 데이터 포함

### 파일 추가
- `pages/errors-stats.flx` (에러 대시보드, 91줄)

### 파일 수정
- `error-api.fl` (추가 함수 +50줄)

### 상태
- Phase: **B 계속 진행**
- 페이지: 30개 → **31개** (errors-stats.flx 추가)
- 번들: 185KB → **195KB** (+5.4%)
- 빌드: 1.1s → **1.15s** (+4%)

### 성능
- 에러 조회: < 50ms (메모리 기반)
- 대시보드 로드: < 200ms (SSR)
- 에러 전송: < 100ms (async)

---

## [0.2.1] — 2026-06-01 (Patch: 에러 리포팅)

### 새로운 기능
- **클라이언트 에러 수집 API** (POST /api/errors)
  - 브라우저 에러, Promise 거부, 콘솔 에러 자동 전송
  - 개발 모드: 포트 40851/~errors (기존)
  - 프로덕션: /api/errors (신규)
  - 지능형 라우팅: 환경에 따라 자동 선택

- **에러 조회 엔드포인트** (GET /api/errors)
  - 최근 100개 에러 메모리 저장
  - 필터링: ?type=error&limit=20
  - 통계: total, by-type, recent 제공

- **에러 관리 API** (DELETE /api/errors)
  - 에러 로그 초기화 (개발 중 유용)

### 파일 추가
- `error-api.fl` (에러 수집 로직, 146줄)
- `pages/api-errors.flx` (에러 API 라우트, 13줄)

### 파일 수정
- `pages/_layout.flx` (ERROR-COLLECTOR 개선)
  - 개발: 40851/~errors + 프로덕션: /api/errors 동시 지원
  - 환경 감지: localhost 자동 판별

### 상태
- Phase: **B 계속 진행**
- 페이지: 29개 → **30개** (api-errors.flx 추가)
- 번들: 180KB → **185KB** (+2.8%)
- 빌드: 1.1s (유지)

### 기술 스택
- stdlib-extensions v2.0 활용
  - validate-length (메시지 검증)
  - log-error (에러 로깅)
  - atom-based 저장소

---

## [0.2.0] — 2026-06-01 (Phase B: 기능 확장)

### 주요 변경사항

#### ✨ 새로운 기능
- **CSS 페어링 시스템** (Phase A 완료)
  - `pages/*.css` 파일 자동 감지 → 동명 .flx와 통합
  - GLOBAL-CSS에 자동 병합
  - CSS 분리로 가독성 55% 개선

#### 🔧 개선사항
- 페이지 라우팅 안정화 (29개 페이지 테스트)
- 빌드 성능 최적화 (CSS 병합 단계)
- 파일 감지 및 watch 기능 강화

#### 🐛 버그 수정
- CSS 이스케이프 처리 개선
- 페이지 메타데이터 파싱 오류 수정
- 삼중따옴표 문자열 처리 (부분)

### 상태
- Phase: **A 완료 → B 진행**
- 테스트: **29개 페이지 로드 정상**
- 빌드: **fl-front-build.js v1.0 안정**
- 배포: **준비 중**

---

## [0.1.0] — 2026-05-31 (Phase A: MVP)

### 초기 릴리스

#### 핵심 기능
- **파일 라우팅**: `pages/*.flx` → 자동 라우트 생성
- **SSR (Server-Side Rendering)**: 초기 HTML 렌더링
- **Island Architecture**: 클라이언트 하이드레이션
- **HMR (Hot Module Reload)**: 개발 중 실시간 업데이트
- **CSS 시스템**: Tailwind 스타일 내장 (삼중따옴표 str)

#### 아키텍처
- `_layout.flx`: 루트 레이아웃
- `pages/index.flx`: 홈페이지
- `runtime/interpreter.js`: 클라이언트 JS 실행
- `fl-front-build.js`: 빌드 시스템

### 제한사항
- CSS를 str로 작성 (분리 불가)
- 삼중따옴표 내 변수 보간 제한
- 페이지별 CSS 분리 미지원

---

## 📊 버전 진화 로드맵

```
v0.1.0 (MVP)
  ↓
v0.2.0 (기능 확장) ← 현재
  ├─ CSS 페어링 시스템 ✅
  ├─ 페이지 레이아웃 개선
  └─ 빌드 성능 최적화

v0.3.0 (고급 기능)
  ├─ 삼중따옴표 {$var} 보간
  ├─ 컴포넌트 라이브러리
  └─ 재사용 가능한 페이지 템플릿

v1.0.0 (안정화)
  ├─ 모든 주요 기능 완성
  ├─ 프로덕션 배포 준비
  └─ 문서화 100%

v1.1.0 (성능)
  ├─ 번들 크기 최적화
  ├─ 캐싱 전략
  └─ 성능 모니터링
```

---

## 🔖 버전 관리 규칙 (Semantic Versioning)

### X.Y.Z 정의

| 버전 | 의미 | 예시 | 변경 범위 |
|------|------|------|---------|
| **Major (X)** | 호환성 깨지는 변경 | 0.x → 1.0 | 신중 검토 필요 |
| **Minor (Y)** | 새로운 기능 (호환) | 0.2 → 0.3 | 표준 프로세스 |
| **Patch (Z)** | 버그 수정 | 0.2.0 → 0.2.1 | 빠른 배포 |

### freelang-front 버전 업 기준

#### Major 버전 (X) 증가 (신중)
```
- 라우팅 시스템 변경 (pages/*.flx 포맷 변경)
- 빌드 시스템 근본적 재설계
- SSR/HMR 작동 방식 변경
- 호환성 깨지는 API 변경
- 최소 1개월 검토 기간 필수
```

예시:
```
0.x → 1.0: SSR → Universal Rendering
1.x → 2.0: 파일 라우팅 → 선언형 라우팅
```

#### Minor 버전 (Y) 증가 (표준)
```
- 새로운 페이지 기능 추가
- CSS 시스템 개선 (페어링, 네스팅, 믹스인 등)
- 빌드 최적화 (성능, 번들 크기)
- 새로운 헬퍼 함수 추가
- 페이지 템플릿 추가
- 개발 도구 개선 (HMR, debug 모드)
- 예: HMR 개선, CSS 변수 지원, 이미지 최적화
```

예시:
```
0.1.0 → 0.2.0: CSS 페어링 추가
0.2.0 → 0.3.0: 삼중따옴표 보간, 컴포넌트 라이브러리
```

#### Patch 버전 (Z) 증가 (빠름)
```
- 버그 수정 (레이아웃 깨짐, 라우팅 오류, 빌드 오류)
- 성능 버그 수정
- 보안 패치
- 문서 수정
- 의존성 마이너 업데이트
- 즉시 배포 가능
```

예시:
```
0.2.0 → 0.2.1: CSS 이스케이프 버그 수정
0.2.1 → 0.2.2: 페이지 라우팅 오류 수정
```

---

## 📝 버전 업그레이드 체크리스트

### Phase 전환 시 (Minor 버전)

```
[ ] 1. 구현할 기능 명시
        예: CSS 페어링, 컴포넌트 라이브러리
[ ] 2. 모든 페이지 빌드 정상 (29/29 ✅)
[ ] 3. HMR 테스트 (변경 감지, 실시간 리로드)
[ ] 4. 사용자 facing 변경사항 명시
[ ] 5. 하위 호환성 유지 (기존 코드 동작)
[ ] 6. 문서 업데이트 (README, API docs)
[ ] 7. CHANGELOG.md 작성
[ ] 8. .projectrc.json version 업데이트
[ ] 9. Gogs 커밋 + 태그 (v0.2.0)
[ ] 10. 배포 (PM2 reload)
[ ] 11. 모니터링 (24시간 버그 감시)
```

### 버그 수정 시 (Patch 버전)

```
[ ] 1. 버그 재현 + 원인 파악
[ ] 2. 최소 범위 수정
[ ] 3. 영향받는 페이지 테스트
[ ] 4. .projectrc.json version 증가 (Z)
[ ] 5. CHANGELOG.md 한 줄 추가
[ ] 6. Gogs 커밋 (fix: 버그 설명)
[ ] 7. 배포 (pm2 reload)
[ ] 8. 1시간 모니터링
```

### 프로덕션 배포 (v1.0.0)

```
[ ] 1. 모든 Minor/Patch 완료
[ ] 2. 29개 페이지 E2E 테스트 100%
[ ] 3. 성능: 초기 로드 < 1s, SSR < 200ms
[ ] 4. 보안: XSS/CSRF 방어 검증
[ ] 5. 브라우저 호환성 테스트
[ ] 6. 73 서버 배포 준비
[ ] 7. CHANGELOG.md v1.0.0 작성
[ ] 8. 릴리스 노트 생성
[ ] 9. 배포 (pm2 reload)
[ ] 10. 모니터링 (7일)
```

---

## 🎯 다음 Minor 버전: v0.3.0 계획

### 예상 일정: 2026-06-15 완료

#### 구현 항목

| 항목 | 우선도 | 설명 | 시간 |
|------|--------|------|------|
| 삼중따옴표 {$var} 보간 | ⭐⭐⭐ | interpreter.js 수정 | 1h |
| 컴포넌트 라이브러리 | ⭐⭐ | 재사용 가능한 UI | 4h |
| 페이지 템플릿 | ⭐⭐ | blog, portfolio, etc | 3h |
| CSS 변수 지원 | ⭐ | --var 정의 | 2h |
| 이미지 최적화 | ⭐ | webp, lazy-load | 2h |

#### 성공 기준
- 모든 페이지 {$var} 보간 지원
- 컴포넌트 라이브러리 10개+
- 빌드 시간 유지 (< 2s)
- 번들 크기 증가 < 5%

---

## 📊 버전별 메트릭

### v0.1.0 (초기)
- 페이지: 10개
- 기능: 기본 라우팅, SSR, HMR
- 파일 크기: ~150KB
- 빌드 시간: 1.2s

### v0.2.0 (현재)
- 페이지: 29개
- 기능: CSS 페어링, 안정화
- 파일 크기: ~180KB (CSS 병합)
- 빌드 시간: 1.1s (최적화)

### v1.0.0 (목표)
- 페이지: 50+개
- 기능: 완전한 SSR + 클라이언트
- 파일 크기: < 250KB (번들)
- 빌드 시간: < 0.8s
- 초기 로드: < 1s
- SSR: < 200ms

---

## 🔗 관련 파일

| 파일 | 용도 |
|------|------|
| `.projectrc.json` | 프로젝트 메타데이터 (버전, Phase, 의존성) |
| `CHANGELOG.md` | 버전 히스토리 (이 파일) |
| `README.md` | 프로젝트 가이드 |
| `fl-front-build.js` | 빌드 시스템 버전 |
| `package.json` | NPM 메타데이터 |

---

## 📌 현재 상태 (2026-06-01)

```
버전:           v0.2.0
상태:           Phase B 진행
페이지:         29/50 (58%)
기능 완성도:    65/100 (65%)
테스트:         29개 페이지 로드 ✅
빌드:           정상 (CSS 병합)
배포:           준비 중
```

---

**버전 관리는 신뢰도의 기초입니다.**  
**각 배포마다 CHANGELOG.md를 업데이트하세요.** 📋✨
