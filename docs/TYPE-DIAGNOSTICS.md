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
반환한다. 진단은 기존 `file/line/column` 필드를 유지하면서 같은 위치를
`source: {file, line, column}`으로도 제공한다. 생성 산출물과 연결되지 않은
진단은 `generated: null`이다.

빌드 상태에는 `sourceMapLines`가 함께 기록된다. 키는 생성된 `_app.fl`의
1-based 줄 번호이고 값은 원본 `.flx`의 `{file, line, column}`이다. 따라서
AI 도구는 원본 진단을 바로 수정하거나, `_app.fl`에서 발생한 위치를 원본으로
역추적할 수 있다. `npm run language:diagnostics`는 임시 build tree의 잘못된
`.flx` fixture, 구조화 진단 필드, 줄별 source map, exit code 1을 함께
재현한다.

개발 서버가 받는 브라우저 오류도 같은 맵을 사용한다. `_app.fl:줄:열`이
스택에 포함되면 `/~errors`와 `/~ai/errors` 결과에
`source_location`과 `generated_location`을 추가해 원본 `.flx` 위치를 제공한다.
이 변환은 `npm run contracts:browser-errors`와 release gate에서 고정 검수한다.

AI가 화면을 해석하지 않고 바로 수정할 수 있도록 같은 endpoint에
`format=json`을 붙일 수 있다. 출력 스키마는 `fl-front-source-context/1`이며
원본 위치, 생성 위치, 주변 소스 줄, 빌드 커밋·재현 명령·파일 hash를 포함한다.
같은 계약은 `npm run front:context -- --file pages/index.flx --line 1`로도
조회할 수 있으며, 이 CLI가 AI 작업의 정본 입력이다.

개발 서버의 `GET /~ai/diagnostics`는 `fl-front-realtime-diagnostics/1` 계약으로
현재 빌드 이슈, HMR 상태, 마지막 정상 빌드의 커밋·라우트 수를 함께 반환한다.
문법 오류가 생겨도 마지막 정상 빌드 정보는 보존되므로 AI가 깨진 생성물을
정상 상태로 오인하지 않고 수정 전후를 비교할 수 있다.

`route-shadow`는 동적 경로가 정적 경로와 겹친다는 사실만으로 경고하지 않는다.
생성된 실제 등록 순서에서 동적 경로가 정적 경로보다 먼저 나올 때만 경고한다.
현재 builder는 정적 경로를 먼저 등록하므로, 겹침이 있어도 안전한 순서는
경고가 아니다.
