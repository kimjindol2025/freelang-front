# 작업 지시서 — 실사용 피드백으로 Trap/fix 키우기

**작성일**: 2026-07-25 KST

**기준선**: 커밋 `78ac484` (빌드 ok · 120 라우트 · 13 헬퍼 · collections 2: scratch, notes)

**선행 문서**: `PLAN_FRONT_LANG_2026-07-25.md` (P0–P7 완료), `docs/AFLDB-COLL.md`, `docs/TRAPS.md`

## 목표

기능 추가가 아니라 **도구를 데이터로 키운다**. 실사용에서 나온 아픈 점만 Trap /
machine-applicable fix / TRAPS.md에 반영한다. 새 화면·새 기능 나열은 이번 범위가 아니다.

## 단계 1. 실사용 프로브 — coll 패턴 todo 앱 (수집 수단)

초소형 todo/inbox 앱 하나를 `_afldb_coll` 공통 패턴으로 추가한다.
**이 앱의 목적은 기능이 아니라 (a) coll 패턴 검증 + (b) 아픈 점 수집이다.**

- `afldb_coll_namespaces`에 ns 등록 + thin `_db` wrapper만. 도메인 필드 최소
  (예: `title`, `done`). UI는 목록+추가+토글이면 충분하다.
- 작성 과정에서 겪는 모든 아픔(막힘, 오해, 디버깅에 5분 이상 쓴 지점)을
  `FEEDBACK_2026-07-25.md`에 한 줄씩 즉시 기록한다. 고치고 나서 몰아 쓰지 말 것 —
  잊는다.
- 기존 앱 3종(/scratch · /events · /notes-afldb)도 실사용하며 같은 파일에 수집한다.

**성공 판정 (coll 패턴 검증 완료 기준):**
1. `fl-front-build.js --json` → ok, 오류 0
2. 신규 ns가 `afldb-coll-known`(Events의 collections)에 잡힌다 → collections 3
3. create/update/delete/history가 API 실호출로 동작한다
4. 신규 앱 `_db`가 도메인 로직 외에 인덱스·키 조작 코드를 갖지 않는다 (thin 확인)

## 단계 2. 아픈 점 → Trap/fix 반영 (수집 종료 조건 포함)

- **Trap화 기준**: 같은 종류의 아픔이 **2회 반복**되면 즉시 Trap 후보로 승격한다.
  1회짜리는 FEEDBACK 파일에 남겨두고 넘어간다.
- **수집 종료 조건**: 아픔 10건 도달 또는 todo 앱 완성 중 먼저 오는 쪽.
  도달하면 수집을 멈추고 반영 작업으로 전환한다 — 무기한 수집 금지.
- 반영 대상 3계층: (1) Trap Checker 추가, (2) machine-applicable이면
  `fl-front-fix.js`에 자동수정 추가, (3) 자동화 불가면 `docs/TRAPS.md`에 문서화.
- 새 Trap마다: 오류 코드 부여(기존 17코드 체계에 편입) + `--codes`에 노출 +
  일부러 틀린 코드로 검출 확인.
- 새 fix마다: `--fix-dry`로 diff 확인 → `--fix` 적용 → 재빌드 ok까지가 한 단위.

## 단계 3. 의도적 보류 — 해제 트리거 명시

다음은 이번에 하지 않는다. 단, 보류는 영구가 아니다:

| 보류 항목 | 해제 트리거 |
| --- | --- |
| APP-DB 대량 rename | 신규 Trap이 해당 레거시를 **3회 이상** 지적하면 해제 검토 |
| undefined-fn / route-shadow 일괄 정리 | 관련 오류가 실사용에서 실제 장애를 1회라도 내면 즉시 해제 |
| Next/bootstrap 전환·코어 수정 | 이번 사이클에서 논의 자체를 하지 않는다 (해제 없음) |

## 제약

- FreeLang 코어(문법·VM·bootstrap 번들)는 한 줄도 건드리지 않는다.
- 데이터 백엔드는 afl-db(`:40610`)만. 기존 fl:* 키와의 호환을 깨지 않는다.
- `logs/`, 런타임 데이터는 커밋하지 않는다.
- 빌드 검증은 항상 `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json`.

## 완료 기준

1. todo 앱이 성공 판정 4개를 모두 통과한다.
2. FEEDBACK 파일에 수집된 아픔이 각각 Trap / fix / TRAPS.md / 보류 중 하나로
   분류 처리되어 미분류 0건이다.
3. 새 Trap·fix가 검출/적용 테스트를 통과하고 기존 진단은 회귀 없다
   (기준선: 120 라우트 · 13 헬퍼 · ok).
4. 작업 묶음이 끝나면 보고 전에 `/gogs` 체크포인트 (커밋 + 블로그).

## 보고

- 변경 파일, 커밋 해시, 신규 Trap/fix 목록(코드 번호 포함), FEEDBACK 분류 결과,
  빌드·API 검증 로그.
