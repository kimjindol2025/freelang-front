# AI Contract Gate

Front 작업을 다음 AI 에이전트가 이어받을 때, 빌드 진단과 manifest를 따로 해석하지
않도록 하나의 기계 판정으로 묶는다.

```bash
node scripts/ai-contract-gate.js --json

# 새 Front 앱 생성 계획과 입력 경계
npm run scaffold:contract
```

출력 스키마는 `fl-ai-gate/1`이며 다음을 포함한다.

- `repoCommit`: 검증한 Git HEAD
- `checks`: build 종료 코드, JSON 출력, error 진단, manifest 스키마
- `build`: `fl-front-build.js --json` 원본 결과
- `manifest`: `fl-manifest.js --json` 원본 결과
- `pass`: 모든 필수 check가 PASS인지 여부

이 gate의 PASS는 정적 빌드·계약 검증 PASS를 뜻한다. 실제 브라우저 화면,
클릭, 네트워크, 스크린샷은 별도의 HTTP/browser 검증으로 남긴다. 빌드가
`EROFS`, runner 부재, 권한 오류로 실행되지 않으면 PASS가 아니라 FAIL/환경
차단으로 기록한다.

`scaffold:contract`는 실제 파일을 쓰지 않는 dry-run으로 생성 대상과 입력
경계를 확인한다. `text`처럼 요청 body와 충돌하는 필드와 경로 탈출 입력은
차단되어야 한다.
