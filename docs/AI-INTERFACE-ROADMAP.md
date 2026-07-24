# FreeLang AI-Interface 로드맵

> **FL을 "AI가 운영하는 언어"로.** 코어(문법·타입·VM·bootstrap.js 44k 번들)는 한 줄도 안 건드린다.
> 전부 *위에 얹는 인터페이스 계층* · *코드에서 자동 생성*("기록이 증명") · *Klar에서 증명된 스키마 재사용*.

(2026-06-05 작성. 배경: Klar로 "새 언어"를 실험 → 가치는 *인터페이스*임을 확인 → FL에 적용. Klar/nael은 동결.)

## 닫아야 할 루프
```
AI → ① manifest 조회(작성 전 이해) → 코드 생성 → ② check --json(진단 수신)
      → ③ 오류 코드로 분류 → ④ 자동수정 → ⑤ 재검사·수렴 ↻
```

| 단계 | FL 현재 상태 |
|------|------|
| Trap Checker (작성 후 잡기) | ✅ master 통합 (fl-front-build.js) + `docs/TRAPS.md` |
| ① Manifest (작성 전 이해) | 🟡 `node fl-manifest.js` (feat/fl-manifest, **6/8 검증 대기**) |
| ② 구조화 진단 `--json` | ✅ `fl-diagnostics/1` (2026-07-25, P2) |
| ③ 오류 코드 카탈로그 | 🟡 **다음(P5)** — 코드 존재, 메타 미정 |
| ④ 자동수정 | ❌ (P6) |
| ⑤ 자가수정 루프 | ❌ |

## 단계 (각 단계 검증 후 다음 — 기능→검증→기록→머지)

### Phase 0 — 기반 (완료/진행)
- Trap Checker ✅ · fl-manifest 🟡(6/8 검증) · AGENTS.md "작성 전 manifest 조회" 안내 ✅

### Phase 1 — 구조화 진단 `fl-build --json` ⭐⭐⭐ (노력 낮음·ROI 최고)
- 빌드 체커가 사람 텍스트 대신 기계 JSON 출력. `issue(level, check, file, line, msg)` 데이터가 *이미 있음* → emitter만.
- 스키마: `{schema:"fl-diagnostics/1", tool:"freelang", version, positions:"1-based", diagnostics:[{code, severity, line, column, message, hint}]}` — Klar `klar-diagnostics/1`와 정렬(rustc식, 1-based, severity "warning").
- **즉시 다음 수.** manifest 검증 통과가 게이트.

### Phase 2 — 오류 코드 카탈로그 (manifest에 통합) ⭐⭐ (노력 낮음)
- `check` 코드 13개에 메타: `{code, title, severity, fixable, applicability}`. manifest `diagnosticCodes`로. Klar가 한 방식.
- 산출: 에이전트가 모든 가능한 에러 + 고칠 수 있는지를 작성 전에 앎.

### Phase 3 — 자동수정 (보수적, provably-safe만) ⭐ (노력 중·위험 높음 → 좁게)
- FL은 동적 → **증명 가능한 것만**: manifest 사전 기반 오타→실존 이름 rename, 하이픈↔언더스코어 정규화, `act` 예약어 rename. 전부 `applicability:"machine-applicable"`.
- 틀린 자동수정은 위험 → 좁게, opt-in. (사용자 우선순위상 마지막.)

### Phase 4 — 자가수정 루프 (capstone) ⭐⭐ (P1~3 의존)
- manifest 조회 → 생성 → `fl-build --json` → safe fix 적용 → 재검사 → 수렴. Klar `fix`가 증명한 루프의 FL판.

## 횡단 원칙
- **FL 코어 불변** — 새 문법·타입·런타임 변경 0. (44k bootstrap.js = esbuild 번들, 건드리지 않음.)
- **자동 생성** — manifest·진단·코드 전부 코드/런타임에서. 수동 문서 금지.
- **스키마 = 불변 계약** (`fl-manifest/1`·`fl-diagnostics/1`). 휘발성 `generatedAt` 배제(결정론).
- **bootstrap.js 무수정·앱 리포에 번들 안 짊어지기** (73 사고 교훈). 런타임은 셸로 읽기만.
- **계측** — 단계마다 "환각 ↓·실수 ↓" 실측 후 다음.

## 정직한 범위
- FL의 발전 가능성은 "인기 언어"가 아니라 **"AI가 운영하는 최초의 실용 언어"** — 솔로·니치라 외부 대중 채택은 낮지만, kim+AI 플랫폼으로서의 잠재력은 크고 거의 안 쓰였다.
- 이 로드맵은 **가볍다**(코어 안 건드림). 무거운 건 새 언어/타입시스템/패키지 생태계 — 전부 의도적으로 배제.

## v12 정렬 (중요 — 2026-06-05 발견)

FL v12는 별도 gogs 리포 2개에서 진행 중: **kim/freelang-v12**(모듈화 + KPM 패키지 매니저 + AI 에이전트 마켓, Phase F ~6/9) · **kim/v12-alpha**(MISTAKES-100 기반 Breaking Changes, `FL_V12=1`). 이 인터페이스 작업은 v12와 *겹치지 않게 분업*해야 한다.

**매핑 (우리 ↔ v12):**
| 우리 | v12 | 관계 |
|------|-----|------|
| `builtin-arity`·`nullable-consume` | A(인자순서)·B(HTTP req-*) | 🔴 겹침 — v12가 언어 에러로 흡수 → 해당 체크는 이관 |
| `db-row-mutation` | D(DB 시그니처) | 🟡 부분 — db-row 직접은 우리가 더 커버 |
| `reserved-word`·`global-shadow`·`route-shadow`·`comment-defn`·`str-loop-concat`·`island-*` | (없음) | 🟢 **우리 고유**(lexer·front·SSR·perf) |
| fl-manifest(언어 API) | KPM(패키지 메타) | 🟢 보완 — 합쳐 발견 표면 |
| JSON 진단(기계 포맷) | v12 hint-error(메시지 품질) | 🟢 보완 — 층 다름 |

**정렬 행동:**
1. 진단 코드를 **MISTAKES-100 `#N`에 매핑**(자체 발명 X) — 단일 카탈로그.
2. **Trap Checker = v12 미반영분 + front 계층** — v12가 A~E를 언어 에러로 내릴수록 해당 체크는 *언어 내장*으로 이관, 우리는 갭 담당.
3. **fl-manifest ⊕ KPM** — 언어 API + 패키지 메타를 같은 에이전트 발견 표면으로.
4. **JSON 진단은 v12 hint-error 위에** — v12=메시지, 우리=기계 포맷. 중복 회피.

(상세: 메모리 `project_freelang_v12`.)

## 즉시 다음 행동 (갱신 2026-07-25)
**Phase 1 완료.** 다음 = **Phase 2 / P5: 오류 코드 카탈로그 → manifest `diagnosticCodes`**.
그다음 Phase 3 / P6 안전 자동수정. 세션 핸드오프: `CHECKPOINT_2026-07-25.md`.
관련 메모리: `project_freelang_v12` · `project_fl_manifest_pending` · `project_fl_trap_checker`.
