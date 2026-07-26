# FIX — FRONT-LANG 오류·함정 명세 (2026-07-26)

## 범위

- `FRONT-LANG.md` — §오류·버그·함정 (A~G) 전면 추가
- `fl-front-build.js` — AGENTS.md 자동 생성에 함정 요약
- `pages/_island-patterns.flx` — 함정 주석 포인터

## 검증

```bash
node fl-front-build.js  # errors 0, AGENTS.md 갱신
grep "오류·버그·함정" FRONT-LANG.md AGENTS.md
```
