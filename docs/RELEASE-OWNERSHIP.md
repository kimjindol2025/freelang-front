# Front 릴리즈 소유·정리표

기준 커밋: `55ca933` (`master`)

이 문서는 현재 작업 트리의 변경을 임의로 삭제하거나 자동 커밋하지 않고,
clean release 전에 확인해야 할 소유 범위를 기록한다.

## 분류

| 범위 | 분류 | 처리 |
|---|---|---|
| `pages/crew/*`, `docs/CREW-EXECUTION-CONTRACT.md` | 기존 기능 작업 | 사용자 검수 후 제품 커밋에 포함 |
| `pages/_http.flx`, `front-language.contract.json` | adapter 계약 작업 | 실제 provider·memory profile 회귀 후 포함 |
| `island-compiler.js`, `pages/logs.flx`, `scripts/front-language-contract.js` | 기존 언어/runtime 작업 | 기존 소유 변경 보존, 전체 gate 재검증 |
| `AGENTS.md`, `FRONT-LANG.md`, `HANDOFF.airc` | 생성·갱신 문서 | 내용 확인 후 포함 |
| `.build-state.json` | 추적 중인 빌드 산출물 | build 결과와 source route가 일치할 때만 포함 |
| `island-runner.js`, `scripts/front-language-conformance.js`, `pages/examples/37-event-stream-contract.flx` | 이번 event-stream 언어 회귀 | conformance PASS 증거와 함께 포함 |
| `COMMERCIALIZATION.md`, `docs/RELEASE-OWNERSHIP.md` | 이번 상용화 문서 | release 기준 문서로 포함 |
| `.freelang/evidence/`, `.freelang/handoff.*`, `.hmr-event.json` | 실행 생성물 | `.gitignore`로 제외 |

## 현재 증거

- `npm run verify:internal`: 정적·HTTP·SSE·SPA PASS
- `node scripts/front-language-conformance.js`: PASS
- `node fl-front-build.js --json`: 153 routes, 0 errors, 0 warnings
- `git diff --check`: PASS
- clean-worktree: BLOCKED (위 표의 기존 소스 변경이 아직 작업 트리에 있음)

## 다음 릴리즈 게이트

1. 표의 기존 기능 변경을 소유자가 확인한다.
2. build-state가 새 route 목록과 일치하는지 확인한다.
3. 전체 gate를 다시 실행한다.
4. 하나의 검토 가능한 커밋으로 묶고 clean clone을 만든다.
5. clean clone build·artifact hash·rollback을 확인한 뒤에만 push/deploy한다.
