# FreeLang Front — Trap 카탈로그

빌드(`fl-front-build.js`)가 잡는 DX 함정. 코어 문법 변경이 아니라 **작성 후 탐지**.

## 활성 Trap

| code | 증상 | 올바른 패턴 | fix |
|------|------|-------------|-----|
| `reserved-word` | `act` 등 예약어를 식별자로 사용 | `action` 등 | machine |
| `json-parse-hyphen` | `(json-parse …)`가 서버에서 `s` 등 헬퍼와 충돌·오염 | `(json_parse …)` underscore만 | machine |
| `upper-hyphen` | `FOO-BAR-BAZ`처럼 하이픈 **2개 이상** 대문자 심볼 → 뺄셈 파싱 | `foo_bar_baz` / `afl_db_base` | — |
| `let-shadow` | `let [s …]` / `h` / `h!`가 주입 헬퍼를 가림 | 다른 이름 (`sess`, `html`, …) | machine |
| `fl-http-allow` | localhost/127.0.0.1 HTTP가 SSRF로 차단 | env `FL_HTTP_ALLOW=127.0.0.1,localhost` | manual |
| `helper-load-order` | `_afldb-coll.flx`가 `_afldb.flx`보다 **먼저** 정렬·로드 → 미정의 | `_afldb_coll.flx` (하이픈→underscore) | machine |

## 문서화 규칙 (자동화 불가 / 1회성)

| 주제 | 규칙 |
|------|------|
| **ns 등록** | 새 coll 앱 → `pages/_afldb_coll.flx` 상단 `afldb_coll_namespaces`에 **append만**. 다른 파일에 ns 목록을 두지 말 것. |
| **라우트 접미사** | 기존 atom/로컬 앱과 이름 겹치면 `/foo-afldb` (예: `/todo` vs `/todo-afldb`). 신규 afl-db 앱은 충돌 시 `*-afldb` 접미사. |
| **PM2 / npm start** | `npm start` = 빌드+기동. `pm2 restart freelang-front` 직후 즉시 curl하면 실패할 수 있음 — `:40860` LISTEN·빌드 완료까지 대기. |
| **괄호** | 중첩 `h()` 편집 전 `check-parens.py` (또는 동등 검증). header에 링크 끼울 때 중복 태그 주의. |
| **afl-db 지연** | GET/POST 왕복 ~1–2초 체감 가능. Trap 아님 — UX/타임아웃 참고만. |
| **공통 CSS** | afldb 앱 공통 CSS 모듈 없음 (1·2사이클 반복). 당분간 인라인 style / 무스타일. 모듈 추가는 보류. |
| **콜드스타트 허용면** | 앱 작성 전: `node fl-manifest.js` + `docs/TRAPS.md` + `docs/AFLDB-COLL.md` + `--codes`. 기존 coll 앱 소스 복사 금지. |
| **fl-loop 계약** | `converged` = **machine-applicable 0건** (자동으로 더 고칠 것 없음). `humanShare`/`humanShareItems` = 사람 몫. **converged ≠ humanShare 0**. |
| **scaffold 필드명** | `text`/`body`/`action`/`id` 는 req body와 충돌 가능 — `content`/`title` 등 사용 (`fl-scaffold.js` BLOCKED_FIELDS). |

## 관련 규칙
- 상수: **소문자 + underscore** (`afl_db_base`). `AFL-DB-BASE` 금지.
- stdlib JSON: `json_parse` (kebab `json-parse` 금지 in front pages)
- style 헬퍼 `s`는 `FL_FRONT_HELPERS` — let 바인딩으로 가리지 말 것
- 헬퍼 자식 모듈: `_부모_자식.flx` — `_부모-자식.flx` 금지 (`helper-load-order`)

## 의도적 보류 — 해제 트리거

| 보류 항목 | 해제 트리거 |
|-----------|-------------|
| APP-DB 대량 rename | 신규 Trap이 해당 레거시를 **3회 이상** 지적하면 해제 검토 |
| undefined-fn / route-shadow 일괄 정리 | 관련 오류가 실사용에서 **실제 장애 1회**면 즉시 해제 |
| Next/bootstrap 전환·코어 수정 | 이번 사이클 **해제 없음** (논의 자체 안 함) |

## 진단 출력
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → schema: fl-diagnostics/1

node fl-front-fix.js --dry   # machine-applicable preview
node -e "console.log(require('./fl-diagnostic-codes').codesSummary())"
```
