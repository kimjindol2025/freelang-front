# FIX — Sidebar Layout (2026-07-26)

## 범위

- `pages/_layout.flx` — 상단 가로 nav → 좌측 사이드바

## 변경

- `layout_shell` flex: sidebar + main
- C2C 섹션 상단: People, Market, Followups, Flow
- 데모 링크 축소: 카운터·문의·스타일 제거, 홈/대시보드/Notes/To-do/About 유지
- 하단: 로그아웃 + 다크모드
- 모바일: sidebar 56px 축소

## 검증

```bash
node fl-front-build.js  # errors 0
pm2 restart freelang-front
curl -sS http://127.0.0.1:40860/people | grep layout_nav
```
