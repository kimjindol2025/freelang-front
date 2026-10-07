# FreeLang Front 검증·내부 배포 흐름

개발 중 빠른 검증:

```bash
npm run build
node scripts/front-typecheck.js --json
node scripts/state-contract-gate.js --json
node scripts/ui-contract-gate.js
BASE_URL=http://127.0.0.1:40860 node scripts/sse-contract-gate.js
BASE_URL=http://127.0.0.1:40860 node scripts/spa-contract-gate.js
```

전체 관문은 한 번의 빌드에서 빌드 진단·Island 회귀 결과를 함께 수집하고,
manifest·UI·타입·상태·SSE·회귀·HTTP smoke를 이어서 실행한다.

```bash
npm run verify

# 현재 서버(127.0.0.1:40860)까지 실제 HTTP 검증
npm run verify:internal
```

`verify:internal`의 HTTP 항목은 서버가 이미 프로젝트의 내부 실행 계약으로
기동되어 있어야 한다. 서버를 자동으로 재기동하거나 PM2 상태를 추측하지 않는다.

판정:

- `PASS`: 실제 명령과 응답이 확인된 항목
- `FAIL`: 코드·검사 자체의 실패
- `BLOCKED`: dirty worktree, 서버 미기동처럼 정책상 실행할 수 없는 항목

dirty worktree는 기존 사용자 변경을 보존하기 위해 `clean-worktree=BLOCKED`로
남을 수 있다. 이 상태에서 기능 검사가 PASS여도 `.freelang/deploy.sh check`는
반드시 배포를 차단한다.

`spa-contract`는 `/people`·`/market`의 실제 HTTP 응답에서 layout, Island
mount, CSP, legacy `eval` 부재를 확인한다. 브라우저 클릭·폼 상호작용은
HTTP PASS로 확대 해석하지 않고 지정된 단일 브라우저 탭 검수로 별도 기록한다.
