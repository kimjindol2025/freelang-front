# FIX — People CRM MVP (2026-07-25)

## 범위
`WORK_ORDER_2026-07-25-PEOPLE-CRM-MVP.md` 구현.
`/people` — 이름·태그·맥락·다음연락·active/dormant. `/contacts` 무변경.

## 구현 (파일·변경 요약)
- `pages/people/_db.flx` — `data/people.db`, count/due/today/add/delete/touch/set-status
- `pages/people/api.flx` — `people-payload` (고유명), GET/POST
- `pages/people/index.flx` — Island PeopleApp (필터·폼·터치 타깃)
- `pages/index.flx` — 홈 카드

## 검증 (curl 명령 + 결과)
```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:40860/people
# → 200

curl -sS http://127.0.0.1:40860/people/api
# keys: active_count, dormant_count, due_count, items, today
# today=2026-07-25

curl -sS -X POST http://127.0.0.1:40860/people/api \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","name":"김테스트","tag":"고객","context":"견적 후속","next_touch":"2026-07-24"}'
# → ok true, active_count=1, due_count=1

# 회귀
# decisions: today+open_count OK · prompts: items only · contacts:200
```

빌드: `errors=0`, Island 테스트 11/11 PASS.

## PM2
```bash
pm2 restart freelang-front
```

## 함정 (이번에도 피한 것)
- `people-payload` 고유명 (전역 `payload` 금지)
- `today`는 SQL 결과를 키로 명시 복사 (`obj-merge` 금지)
- `/contacts`·activities 미사용 · DB 분리
- **Island 마운트**: render에 `PeopleApp` 심볼만 넣으면 화면에 이름만 출력됨.
  → `"ISLAND_PLACEHOLDER"` + `"ISLAND_SCRIPTS"` 필수 (contacts/vault 패턴).
  Decisions/Prompts도 동일 버그로 함께 수정.
- **Island 런타임 SyntaxError**: FreeLang이 스크립트 문자열의 `\n`/`\d`를 재해석해
  `console.error('...'+msg+'\n'+stack)` 가 줄바꿈으로 깨짐 → 전 Island 미마운트.
  → `island-compiler.js`에서 `String.fromCharCode(10)` · `[0-9]` 로 이스케이프 제거.
- **`cond is not defined`**: Island emit에 `cond` 미구현 → ternary 체인으로 추가.
- **PM2 HMR 연결 스팸**: `npm start`에는 `:40851` dev HMR이 없으므로 2회 실패 후 중단. 에러 수집은 `/api/errors`만 사용.
- 보류: **APP-DB rename 0/3 · undefined-fn/route-shadow 실장애 0/1**
