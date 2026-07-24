# FIX — afl-db 실사용 앱 3종 (2026-07-25)

## 범위
A Scratch · B Events · C Notes(afl-db 초소형 이관)

## 수정
- `_afldb.flx`: `afldb-delete`, index add/remove, `afldb-load-values`
- `/scratch` + `/scratch/api` — 스크래치 메모 (index `fl:scratch:*`)
- `/events` + `/events/api` — history 뷰어 (알려진 fl:* 키)
- `/notes-afldb` + `/notes-afldb/api` — `/notes` SQLite와 병행 afl-db 메모
- 홈 앱 그리드 링크 3개 · `/notes`에 afl-db 버전 링크

## 검증
```bash
curl -sS http://127.0.0.1:40860/scratch/api
curl -sS -X POST http://127.0.0.1:40860/scratch/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","title":"hello","body":"x"}'
curl -sS -X POST http://127.0.0.1:40860/notes-afldb/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","content":"n"}'
curl -sS http://127.0.0.1:40860/events/api
# pages 200: /scratch /events /notes-afldb
```

실측: scratch/notes add OK · events known keys 반영 · 페이지 200
