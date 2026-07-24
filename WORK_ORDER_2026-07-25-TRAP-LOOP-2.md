# 작업 지시서 — Trap 루프 2사이클: 잔검증 + 콜드스타트 실험

**작성일**: 2026-07-25 KST

**기준선**: 커밋 `78dc7f8` (빌드 ok · 122 라우트 · 13 헬퍼 · 진단 코드 18 ·
collections 3: scratch, notes, todo)

**선행 지시서**: `WORK_ORDER_2026-07-25-TRAP-LOOP.md` (1사이클 완료 —
FEEDBACK 10건, helper-load-order Trap, 보류 트리거 문서화)

**영역**: 프론트 언어(FreeLang .flx + 빌드·진단·자동수정 도구 계층)만.
다른 앱·다른 레포와 연결하지 않는다.

---

## 단계 1. 1사이클 잔검증 (먼저, 짧게)

이전 보고에서 미완으로 남은 2가지를 닫는다.

- [ ] **fix 적용 후 재빌드 검증**: `helper-load-order`의 rename apply가
  빌드보다 뒤였는지 확인하고, apply 이후 상태에서
  `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json` → ok · err 0을
  다시 확인한다. 이미 검증됐다면 그 근거(시점)를 한 줄로 남기면 끝.
- [ ] **FEEDBACK 분류 내역 숫자화**: `FEEDBACK_2026-07-25.md` 상단에
  `Trap N / fix N / 문서화 N / 보류 N (합계 10)` 한 줄을 추가한다.
  이후 모든 사이클 보고는 이 형식을 쓴다.

## 단계 2. 콜드스타트 실험 — 문서만 보고 앱 하나 (2사이클 수집 수단)

1사이클의 todo 앱은 코드베이스를 아는 작성자가 만들었다. 이번엔 인터페이스
계층의 진짜 시험을 한다: **"AI가 운영하는 언어"라는 목표가 사실인지.**

- [ ] 새 ns 앱 1개(예: bookmark/링크 저장 — 초소형, 목록+추가+삭제)를
  **다음 문서·도구만 참고해서** 작성한다:
  `fl-manifest.js` 출력, `docs/TRAPS.md`, `docs/AFLDB-COLL.md`, `--codes` 목록.
  **기존 앱 소스(scratch/notes/todo)를 열어보지 않는다** — 열어야만 했다면
  그 사실 자체가 아픔 1건이다 (무엇이 문서에 없었는지 기록).
- [ ] 작성 중 아픔은 `FEEDBACK_CYCLE2_2026-07-25.md`에 즉시 한 줄씩.
  1사이클과 같은 규칙: 막힘·오해·5분 이상 디버깅.
- [ ] **fl-manifest 검증 완주**: 로드맵에 6/8로 남아 있는 manifest 검증을
  이 실험 과정에서 8/8까지 채운다. 부족한 2개가 무엇이었는지 명시.

**성공 판정**:
1. 빌드 ok · err 0, collections 4
2. CRUD 실호출 동작 + `afldb-coll-known`에 신규 ns 표시
3. thin `_db` (키·인덱스 조립 없음)
4. **기존 앱 소스 참조 0회** — 참조가 필요했던 지점은 전부 FEEDBACK에 기록됨
5. fl-manifest 검증 8/8

## 단계 3. 2사이클 Trap/fix 반영

1사이클과 동일 규칙:

- 같은 아픔 **2회 반복** 시 Trap 승격 (1사이클 FEEDBACK과 합산해서 센다 —
  1사이클 1회 + 2사이클 1회 = 승격).
- 수집 종료: 아픔 10건 또는 콜드스타트 앱 완성 중 먼저 오는 쪽.
- 반영 3계층: Trap Checker / machine-applicable이면 `fl-front-fix.js` /
  자동화 불가면 `docs/TRAPS.md`.
- 새 Trap: 코드 부여(현행 18 체계에 편입) + `--codes` 노출 + 오검출 테스트.
- 새 fix: `--fix-dry` diff → `--fix` 적용 → **재빌드 ok까지 한 단위** (단계 1의
  교훈 — 재빌드가 단위의 끝이다).
- **콜드스타트 특유의 아픔은 우선 문서(TRAPS.md/AFLDB-COLL.md/manifest) 보강으로
  반영한다** — 문서만 보고 못 만들었다면 고칠 곳은 코드가 아니라 문서다.

## 단계 4. 보류 트리거 카운트 시작

- [ ] 보류 항목(APP-DB 대량 rename, undefined-fn/route-shadow)에 대해
  이번 사이클 Trap이 지적한 횟수를 `CHECKPOINT_TRAP_LOOP` 문서에 기록한다.
  (해제 조건: rename은 3회 지적, 일괄 정리는 실장애 1회 — 카운트가 있어야
  트리거가 작동한다)
- Next/bootstrap/코어는 여전히 논외. 해제 없음.

## 제약 (1사이클과 동일)

- FreeLang 코어(문법·VM·bootstrap 번들) 불변.
- 백엔드는 afl-db(`:40610`)만, 기존 `fl:*` 키 호환 유지.
- `logs/`·런타임 데이터 커밋 금지.
- 빌드 검증은 항상 `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json`.

## 완료 기준

1. 단계 1 잔검증 2건이 닫히고 근거가 문서에 있다.
2. 콜드스타트 성공 판정 5개 통과 (특히 4번 — 소스 참조 0회 또는 전량 기록).
3. FEEDBACK_CYCLE2 미분류 0건 + 분류 내역 숫자 한 줄
   (`Trap N / fix N / 문서화 N / 보류 N`).
4. 기존 진단 회귀 없음 (기준선: 122 라우트 · 13 헬퍼 · 코드 18 · ok).
5. 보고 전 `/gogs` 체크포인트 (커밋 + 블로그).

## 보고 양식 (고정)

- 단계별 결과 표 + 분류 내역 숫자 한 줄
- 신규 Trap/fix/문서 보강 목록 (코드 번호 포함)
- **fix마다 "apply 후 재빌드 ok" 명시**
- fl-manifest 8/8의 마지막 2개가 무엇이었는지
- 커밋 해시(전체) · 푸시 범위 · 블로그 URL · 제외 목록
