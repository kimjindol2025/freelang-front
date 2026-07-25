# 작업 지시서 — 졸업 마감 + 진단 사각지대 해소 (reserved-word: let)

**작성일**: 2026-07-25 KST  
**상태**: ✅ **마감** (구현 `91397b3` · 재검증 HEAD `32dac2c`)

**기준선 (착수 시 문서)**: `54bb373`  
**재검증 기준선**: `32dac2c` — 126 routes · 13 helpers · 19 codes · ok · warn 26

**선행**: `WORK_ORDER_2026-07-25-TRAP-LOOP-3.md` — 루프 실전 검증 통과
(MA 4/4 · 무한루프 0 · 오수정 0), 수집 루프 졸업은 **조건부** 상태였음.
3사이클에서 발견된 진단 사각지대: reserved-word가 `defn`은 잡지만
`let` 바인딩의 예약어 사용은 **미진단** → `topLevelLetBindings`로 해소.

**영역**: 프론트 언어(도구 계층)만.

---

## 지시서 교정 (착수 관문)

외부 요약 지시서에 “보류 1 = reserved-word/let”이 있었으나 **사실과 어긋남**.  
CYCLE3 보류 1 = `fl-loop` dry-run 사람몫 미표시.  
reserved let은 문서화 #2였고, 본 지시서에서 Trap/fix로 해소했다.  
→ 잘못된 전제로 이력을 덮어쓰지 말 것 (`CHECKPOINT_TRAP_LOOP` 졸업 마감 사유 유지).

---

## 단계 1. 졸업 마감 — 문장 2개

- [x] **교차 반복 N=1(공통 CSS) 승격 예외 사유**: 앱 간 스타일 자산 부재 → 빌드 Trap 부적합 → TRAPS 문서화
- [x] **보류 1건의 정체 명시**: 보류 1 = dry-run 사람몫 미표시 (아님≠let). let은 별도 해소

## 단계 2. reserved-word `let` 진단

- [x] 재현 픽스처 → 미진단 증거(LOOP-3) → `topLevelLetBindings` 확장
- [x] 기존 `reserved-word` 코드 유지 (신설 아님) · `--codes` / diagnosticCodes 반영
- [x] 오검출 0: 정상 let · 문자열 `"act"` · 주석

## 단계 3. 자동수정

- [x] machine-applicable · `fl-front-fix` dry→fix→재빌드 ok (`act`→`action`, 본문 식별자 포함)

## 단계 4. 문서 동기화

- [x] `TRAPS.md` · `AI-INTERFACE-ROADMAP.md` · `CHECKPOINT_TRAP_LOOP_2026-07-25.md`

## 단계 5. 루프 축소판 1회

- [x] 검출 → fix → 종료 · 무한루프 0 · 오수정 0 (재검증 2026-07-25 오후)

## 단계 6. 후보 목록 공개

- [x] 로드맵에 공개 · **착수 0건**

## 완료 기준

1. [x] 졸업 마감 문장 2개
2. [x] 성공 판정 (검출·오검출0·fix·루프·회귀없음)
3. [x] 후보 목록 + 근거 (착수 0)
4. [x] 보류 카운트 `0/3 · 0/1`
5. [ ] `/gogs` — 커밋·블로그 후 **push는 사용자 확인 시**
