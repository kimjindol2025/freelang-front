# FEEDBACK CYCLE2 — 2026-07-25 (콜드스타트)

**분류 내역: Trap 0 / fix 0 / 문서화 7 / 보류 3 (합계 10)**

규칙: 문서·도구만 — `fl-manifest.js`, `docs/TRAPS.md`, `docs/AFLDB-COLL.md`, `--codes`.
기존 앱 소스(scratch/notes/todo) 열지 않음. 열었으면 그 사실=아픔.

형식: `- [시각] 어디 | 아픔 | 조치(즉시|보류)`

---

- [01:22] manifest | `docs`에 AFLDB-COLL 경로 없음 — coll 앱 진입점이 TRAPS만으로는 안 보임 | 즉시→manifest docs.afldbColl
- [01:22] manifest | `traps` 배열이 helper-load-order 누락(4개만) — 활성 Trap과 불일치 → 6/8의 구멍 | 즉시→traps 5개+verification 8/8
- [01:23] AFLDB-COLL | `_db` 스니펫만 있고 `pages/<name>/{_db,api,index}` 스캐폴드·라우트 규칙 없음 | 즉시→AFLDB-COLL 스캐폴드 + manifest.afldbColl
- [01:23] AFLDB-COLL | POST action 계약(add/delete/history) 미기재 — API 페이지를 문서만으로 못 씀 | 즉시→AFLDB-COLL API 관례
- [01:24] 허용 문서 | `layout-html`/`h`/`form-get`/`server-json`이 TRAPS·AFLDB·manifest·codes에 없음 — UI 작성 시 AGENTS 유혹 | 즉시→AFLDB-COLL에 최소 UI 레시피
- [01:24] 허용 문서 | CSS/공통 클래스 없음(1사이클 #10과 동일 계열 2회) | 즉시→2회→TRAPS(공통 CSS 보류 유지, 문서에 “인라인/최소” 명시)
- [01:25] events | collections 확인 URL이 콜드스타트 문서에 없음 (`/events/api`) | 즉시→AFLDB-COLL에 검증 curl
- [01:25] ns | `_afldb_coll.flx` append는 문서상 필수 — 모듈 상단만 열음(앱 소스 아님). 전체 CRUD 구현을 읽지 않음 | 보류(허용 행위)
- [01:26] Island | fetch!/Island 패턴이 허용 문서에 없음 → SSR form POST로 회피 | 보류(1회, 문서화로 충분)
- [01:26] 홈 링크 | index.flx 링크 추가는 앱 완성과 무관·문서 없음 — 생략 | 보류(1회)

## 수집 종료

아픔 10건 도달 + `/bookmarks` 앱 완성 → 수집 중지, 단계 3 반영.

## 단계 3 분류 (미분류 0)

| # | 아픔 | 분류 | 반영 |
|---|------|------|------|
| 1 | manifest docs에 AFLDB-COLL 없음 | 문서화 | `fl-manifest.js` docs.afldbColl |
| 2 | traps 배열 stale (6/8 구멍) | 문서화 | traps+verification 8/8 |
| 3 | 페이지 스캐폴드 없음 | 문서화 | AFLDB-COLL + manifest.afldbColl.scaffold |
| 4 | POST action 계약 없음 | 문서화 | AFLDB-COLL API 관례 |
| 5 | UI 헬퍼 미기재 | 문서화 | AFLDB-COLL 최소 UI 레시피 |
| 6 | 공통 CSS 없음 (2회) | 문서화 | TRAPS.md 공통 CSS 행 |
| 7 | collections 검증 URL | 문서화 | AFLDB-COLL curl |
| 8 | ns 등록 위해 coll 모듈 상단 | 보류 | 허용(앱 소스 0회) |
| 9 | Island 패턴 부재 | 보류 | SSR form로 회피 |
| 10 | 홈 링크 문서 없음 | 보류 | 생략 |

**미분류: 0** · **기존 앱 소스 참조: 0회** · **신규 Trap/fix: 없음** (콜드스타트 아픔→문서 보강 우선)
