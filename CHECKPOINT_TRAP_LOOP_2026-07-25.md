# CHECKPOINT — Trap loop (2026-07-25)

**지시서**: LOOP · LOOP-2 · `WORK_ORDER_2026-07-25-TRAP-LOOP-3.md`

## 보류 트리거 카운트 (공개 형식)

**`APP-DB rename 지적 0/3` · `undefined-fn/route-shadow 실장애 0/1`**

| 항목 | 해제 트리거 | 누적 | 표기 |
|------|-------------|------|------|
| APP-DB 대량 rename | 지적 ≥3 | 0 | **0/3** |
| undefined-fn / route-shadow | 실장애 1 | 0 | **0/1** |
| Next/bootstrap/코어 | 해제 없음 | — | — |

## 교차 반복 (1×2)
N=1 (공통 CSS) — TRAPS 문서화 완료, 추가 checker 승격 없음.

## 졸업 규칙 (정식)
신규 Trap 0 + 신규 fix 0이 **2사이클 연속**이면 수집 루프 졸업.

## 사이클 요약
| 사이클 | 분류 | Trap/fix |
|--------|------|----------|
| 1 | Trap 1 / fix 1 / 문서화 5 / 보류 3 | helper-load-order |
| 2 | Trap 0 / fix 0 / 문서화 7 / 보류 3 | 문서만 |
| 3 | Trap 0 / fix 0 / 문서화 4 / 보류 1 | 루프 실전·문서만 |

→ **졸업** (2·3 연속 0/0)

### 졸업 마감 사유 (DIAG-BLINDSPOT 단계1)

1. **교차 반복 N=1(공통 CSS) 승격 예외**: 공통 CSS 부재는 단일 `.flx` 문법 오류가 아니라
   **앱 간 스타일 자산 부재**라서 빌드 Trap이 파일 단위로 기계 검출하기 어렵다
   (오탐·강제 스타일 규정화 위험). → **문서화(TRAPS.md)로 처리**, checker 승격 안 함.
2. **CYCLE3 보류 1의 정체**: 보류 1 = **`fl-loop` dry-run에 사람몫 목록 미표시**
   (계약상 MA만 수렴). **아님** — reserved-word/`let` 사각지대.
   let 예약어 미진단은 CYCLE3에서 **문서화(#2)** 로 남겼고,
   **`WORK_ORDER_2026-07-25-DIAG-BLINDSPOT.md`에서 해소**한다.

## 3사이클 루프 실전

**픽스처 정책**: `pages/` 임시 주입 → 종료 후 삭제·커밋 미포함 (`fixtures/` 미채택).

| 주입 코드 | 자동수정/사람몫 | 비고 |
|-----------|-----------------|------|
| json-parse-hyphen | 자동 | 1라운드 수정 |
| let-shadow | 자동 | apply count=3(본문 포함) |
| reserved-word | 자동(부분) | defn act→action; let act 잔존·미진단 |
| helper-load-order | 자동 | rename → `_afldb_loopfix.flx` |
| upper-hyphen | 사람몫 | 오수정 0 |
| undefined-fn | 사람몫 | 오수정 0 |
| comment-defn | 사람몫(의도) | 오수정 0 |

- 반복: **2** (round1 fix → round2 clean) · 무한루프 0
- MA 성공/주입: **4/4** (reserved는 진단분 기준 성공; let act는 미진단 잔존)
- 오수정(비픽스처): **0** · 제거 후 기준선 124r/13h/18c/ok

## DIAG-BLINDSPOT (졸업 마감 + reserved-word/let)

- 미진단 증거: LOOP-3 픽스처에서 `(let [… act …])` 잔존·미진단 확인됨.
- 택: **기존 `reserved-word` 확장** (신설 코드 아님) — 동일 오류 클래스, 파서만 교체(`topLevelLetBindings`).
- 구현 커밋: `91397b3`.
- fix: machine-applicable 유지 · apply 후 재빌드 ok · 루프 축소판 2라운드 수렴.
- 오검출: 정상 let·문자열 `"act"`·주석 속 `(let [act` → 진단 0·fix 0.
- 픽스처: pages 임시·커밋 미포함·삭제 원복.

### 재검증 (HEAD `32dac2c`, 2026-07-25 오후)

| 항목 | 결과 |
|------|------|
| 기준선 | 126 routes · 13 helpers · 19 codes · build ok · **`summary.warnings` 26** |
| 블로그 1311 | redaction → 짧은 해시 `43c4ee9` 정정 완료 |

### warnings 26 vs 67 — 원인 (팀장 검수 후 확정)

| 수치 | 조건 | undefined-fn |
|------|------|----------------|
| **26** (정본) | `node runtime/bootstrap.js ls-fns` 성공·파싱 ≥1 | **2** (`conj`,`js-keys` in `[id].flx`) |
| **67** | `loadFreeLangStdlib()` 실패 또는 파싱 0건 | **43** (+41) |

차이 구성: undefined-fn만 2→43. arity1 · global-shadow14 · route-shadow6 · str-loop-concat3 동일.

**67 재현 (검증됨):** `FL_BOOTSTRAP`이 **존재하는 파일**이어야 함.
(`/nonexistent`는 후보 fallthrough로 local bootstrap을 쓰므로 67이 안 남.)
```bash
printf 'process.exit(1)\n' > /tmp/fl-bootstrap-fail.js
FL_HTTP_ALLOW=127.0.0.1,localhost FL_BOOTSTRAP=/tmp/fl-bootstrap-fail.js \
  node fl-front-build.js --json \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["summary"])'
# → warnings 67 · stdlibLoadOk false · stdlibLsFnsCount 0 · undefined-fn 43
```

**26 재현 (정본):**
```bash
node runtime/bootstrap.js ls-fns 2>/dev/null | wc -l   # 파싱 가능한 줄 존재
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["summary"])'
# → warnings 26 · stdlibLoadOk true · stdlibLsFnsCount ~485 · undefined-fn 2
```

주의: 옛 주석 “빈 Set = 모든 함수 허용”은 **거짓**. helper만 known → undefined-fn 폭증.  
summary에 `stdlibLoadOk` / `stdlibLsFnsCount` 추가 — **정본 판별은 `stdlibLoadOk==true`일 때의 warnings**.  
팀장 67은 ls-fns 로드 실패 증상으로 설명됨.  
(이후 `0c525f8`·`672ffd4`는 Gogs `origin/master`에 push 완료 — 위 “push 보류”는 **당시** 상태.)

### DIAG-COVERAGE-SWEEP (2026-07-25)

| 항목 | 결과 |
|------|------|
| 미진단 증거 | `let-shadow`가 `[^\]]*`로 중첩 `]` 뒤 바인딩(`s`/`h`) 미검출 |
| 수정 | 브래킷 매칭 + `topLevelLetBindings` + `maskStringsPreserveLines` (예제 문자열 FP 방지) |
| 새 code | 없음 (기존 `let-shadow` 확장) |
| 오검출 | 주석·문자열 `"s"`·playground 예제 문자열 → 0 |
| fix | machine-applicable 유지 · nested `s`→`sess` |
| 기준선 | warnings **26** · stdlibLoadOk true · 126r/13h/19c |
| 보류 | APP-DB **0/3** · undefined-fn/route-shadow **0/1** · 후보 착수 0 |

### DIAG-COVERAGE-FIX-FP (2026-07-25) — `6647e07` 보완

| 항목 | 결과 |
|------|------|
| 원인 | build는 주석/문자열 마스크, **fix**는 raw `/\(let\s+\[/` → 오수정 |
| 수정 | `findNextLet` 공유 + rename `mapOutsideStrings`; build `stripComments`에 `#|` |
| build 진단 FP | `;` / 문자열 / `#|` → **0** |
| fix 오수정 | 동일 fixture → **filesChanged 해당 0**; nested만 후보 |
| 기준선 | warnings **26** · fixable 0 · loop remaining 0 |
| 보류 | APP-DB **0/3** · undefined-fn/route-shadow **0/1** |

| 오검출 | normal_let / `"act"` 문자열 / 주석 `(let [act` → reserved-word **0** |
| 검출 | `(let [… act …])` → error `reserved-word` (let 바인딩) |
| 루프 축소판 | detect → `fl-front-fix --fix` (act→action) → rebuild ok → 픽스처 삭제 · 무한루프 0 · 오수정 0 |
| 지시서 교정 | “보류 1 = let”은 **틀림**. CYCLE3 보류 1 = dry-run 사람몫 미표시. let은 문서화 #2 → 본 트랙에서 해소. |
| 후보 공개 | `docs/AI-INTERFACE-ROADMAP.md` · **착수 0건** |
| 보류 카운트 | **0/3 · 0/1** |
