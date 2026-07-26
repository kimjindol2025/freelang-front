# FIX — Front 언어 Island 4대 패턴 편입 (2026-07-26)

## 범위

- `FRONT-LANG.md` — FreeLang Front = SSR + API + Island 3층 정본
- `fl-front-build.js` — AGENTS.md 자동 생성에 3층·4대 패턴 섹션
- `pages/_island-patterns.flx` — 패턴 주석 헬퍼
- `pages/examples/31-island-patterns.flx` — P1~P3 라이브 예제

## 검증

```bash
node fl-front-build.js  # errors 0, 139 routes, Island 11/11
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/examples/31-island-patterns
```
