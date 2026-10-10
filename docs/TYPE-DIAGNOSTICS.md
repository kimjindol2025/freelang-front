# FreeLang Front 타입·진단 계약

Front의 타입 검사는 두 층으로 나눈다.

1. 소스 검사: `fl-tools check`가 프로젝트의 `.fl` 소스와 테스트를 검사한다.
2. 생성물 검사: canonical FX runner가 빌드 결과 `_app.fl`을 검사한다.

둘을 합친 기계 판정은 다음 명령으로 실행한다.

```bash
npm run build
npm run typecheck
node scripts/front-typecheck.js --json
npm run language:diagnostics
```

`npm run`은 npm 자체 배너를 stdout에 출력할 수 있으므로, JSON을 파이프로
넘길 때는 두 번째처럼 스크립트를 직접 호출한다.

출력 스키마는 `fl-front-typecheck/1`이다. 두 check가 모두 `PASS`일 때만
`pass=true`이며, `_app.fl`이 없거나 FX runner가 없으면 성공으로 간주하지
않는다.

## 왜 두 단계인가

`fl-tools check`는 소스의 실행·문법·타입 계약을 담당하고, Front builder가
생성하는 `_app.fl`에는 라우트 등록·레이아웃·주입 helper가 합쳐진다. 소스만
검사하면 생성 단계의 오류를 놓칠 수 있고, bundled 구형 runtime으로 `_app.fl`을
검사하면 최신 `&` rest 계약을 이해하지 못해 오진할 수 있다. 따라서 생성물은
프로젝트가 실제 사용하는 canonical FX runner로 검사한다.

## Release gate 연결

`scripts/next90-release-gate.js`는 `front-typecheck`를 호출해 소스와 생성물을
동시에 확인한다. 이 검사는 빌드를 대신하지 않으므로 항상 먼저 `npm run build`
를 실행해야 한다.

메타데이터 누락은 현재 FreeLang runner의 경고로 남을 수 있다. 문법·타입
오류와 경고를 섞어 PASS로 보고하지 않으며, 오류가 발생하면 exit code가 1이
된다.

문법 오류는 `fl-diagnostics/1`의 `syntax` 진단으로 파일·라인·힌트를 포함해
반환한다. `npm run language:diagnostics`는 임시 build tree의 잘못된 `.flx`
fixture로 이 계약과 exit code 1을 재현한다.

`route-shadow`는 동적 경로가 정적 경로와 겹친다는 사실만으로 경고하지 않는다.
생성된 실제 등록 순서에서 동적 경로가 정적 경로보다 먼저 나올 때만 경고한다.
현재 builder는 정적 경로를 먼저 등록하므로, 겹침이 있어도 안전한 순서는
경고가 아니다.
