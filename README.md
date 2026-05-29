# freelang-front

FreeLang v11 fx 기반 풀스택 프론트엔드 언어

> npm install 0개로 Next.js + Tailwind + Zustand + TanStack 스택 전체 대체

## 구조

```
pages/          ← 라우트 (.flx)
  index.flx     → GET /
  about.flx     → GET /about
  [id].flx      → GET /:id
  api/
    hello.flx   → GET /api/hello
components/     ← 재사용 컴포넌트
styles/         ← 글로벌 CSS DSL
public/         ← 정적 파일
server.fl       ← 메인 서버
router.fl       ← 라우트 스캐너
SPEC.airc       ← 설계 문서
```

## 실행

```bash
freelang server.fl
```

## Phase 로드맵

| Phase | 내용 | 상태 |
|-------|------|------|
| P1 | 파일 라우터 + dev-server | 🔨 진행중 |
| P2 | CSS DSL + 빌드 | 📐 설계 |
| P3 | Island 컴파일러 | 📐 설계 |
| P4 | query/form/atom 내장 | 📐 설계 |
| P5 | SVG 차트 + HMR | 📐 설계 |
