# F-4 전체 프론트 빌드의 네이티브 이행 기록

## 1. JS 빌드 단계와 v11 네이티브 가능 여부

| 단계 | JS 위치 | 확인 결과 |
| --- | --- | --- |
| 캐시 읽기·MD5 파일 해시 | `fl-front-build.js:30`–`38` | 파일 I/O 가능, 네이티브 cgc의 MD5 함수 없음 |
| 표준 함수 목록을 Node CLI로 조회 | `fl-front-build.js:80`–`104` | 대응하는 네이티브 함수 목록 조회 경로 확인 못함 |
| 페이지 재귀 탐색·라우트 이름 생성 | `fl-front-build.js:594`–`646` | 가능, `build.fl`로 이행·일치 확인 |
| 최상위 헬퍼 탐색·의존 순서 | `fl-front-build.js:618`–`633` | 가능, `build.fl`로 이행·일치 확인 |
| 스타일과 같은 이름의 CSS 병합 | `fl-front-build.js:1245`–`1264` | F-3 `style-compiler.fl` 재사용, CSS 원문 일치 |
| 네임스페이스·load 인라인·스타일 블록 제거 | `fl-front-build.js:44`–`71`, `867`–`909`, `1065`–`1095` | 문자열 조작은 가능하나 JS 정규식 변환을 아직 이행하지 않음 |
| 공통 헬퍼와 레이아웃 CSS 주입 | `fl-front-build.js:684`–`1069` | 큰 정적 템플릿과 페이지 결합을 아직 이행하지 않음 |
| server-fn·defstore·Island를 페이지별로 컴파일 | `fl-front-build.js:1074`–`1170`, `island-compiler.js:5`–`476` | 네이티브 Island 파서·JS 방출기 없음, 남은 핵심 Node 단계 |
| 라우트 등록문 생성 | `fl-front-build.js:1196`–`1210` | 가능, 113개 라우트의 등록문 원문 일치 |
| 전체 `_app.fl`·소스맵 생성 | `fl-front-build.js:840`–`1226`, `1663`–`1664` | 등록문까지만 이행, 전체 앱 생성은 미완 |
| 검증·Island 회귀 시험 | `fl-front-build.js:1258`–`1650`, `2111`–`2207` | JS 경로 유지, 기존 시험 11/11 통과 |
| AGENTS·캐시·상태 파일 기록 | `fl-front-build.js:394`–`590`, `2210`–`2238` | 아직 이행하지 않음. 상태 파일의 실행 시각·소요 시간도 변함 |
| 정적 파일 복사 | `fl-front-build.js` 전체 | 해당 단계 없음: 파일 복사 호출을 찾지 못함 |

## 2. 새 빌드 구조

- `scripts/build-fl.sh:1`–`16`: F-3 스타일 변환기를 실행한 뒤 x86 네이티브 cgc로 `build.fl`을 컴파일·실행한다.
- `build.fl:2`–`51`: 페이지를 재귀 탐색하고 정적·동적 라우트의 JS 순서를 재현한다.
- `build.fl:52`–`72`: 최상위 헬퍼 순서를 재현한다.
- `build.fl:73`–`87`: GET·POST·와일드카드 라우트 등록문을 생성한다.
- `build.fl:88`–`106`: 라우트·헬퍼 JSON과 등록문을 `tests/build-actual/`에 기록한다.
- `tests/build-golden/capture.sh:1`–`11`, `tests/build-golden/compare.sh:1`–`48`: 기준 캡처와 생성물 비교. 두 스크립트는 실행 전에 커밋했다.

이 빌드는 **부분 이행**이다. `_app.fl`을 만들지 않으므로 `package.json`의 전체 JS 빌드 명령은 바꾸지 않았다. 기존 JS 파일도 보존했다.

## 3. 기준과 비교 결과 원문

기준은 `92f4f26a373045461791e3703edec75dc5179905`에 구현보다 먼저 커밋했다. `_app.fl`, `app.css`, `build-state.json`은 원문이다. `AGENTS.md`는 이미 추적 중인 파일이고, 그 파일과 절대 경로가 포함된 `.build-cache.json`은 원문을 중복 공개하지 않도록 SHA-256으로 고정했다. 비교에서는 `_app.fl` 2행의 생성 시각만 제외한다. 기준 파일은 이후 수정하지 않았다.

```
c6f3404e5248cc42e4971dd06b1242111e826329517c251065b553dfd12772ad  tests/build-golden/_app.fl
dcd2bb1ca7ec6ba712a24d007984763a4d41f0b24a703a937ab88ce753a6058b  tests/build-golden/app.css
e83c348455451c96776d2d541c816af526f93f1b18591164886c6560529b01be  tests/build-golden/build-state.json
ceca6628bfb98bcee4203d5c010ffd473ad85df7357feb0e8671c61d8443edb9  AGENTS.md
49bb79e7ebb95759a10294bba282bd0781c6c23a5b2f6fa4e5b48c25692ebf0d  .build-cache.json
```

네이티브 빌드 후 전체 생성물 비교의 표준 출력 원문:

```
MISSING: tests/build-actual/_app.fl
MISSING: tests/build-actual/build-state.json
MISSING: tests/build-actual/.build-cache.json
MISSING: tests/build-actual/AGENTS.md
BUILD_CMP_FILES=5
BUILD_CMP_FAILURES=4
```

`app.css`의 `cmp`는 출력 없이 종료 코드 0이었다. 지원 단계의 추가 원문 비교:

```
ROUTES_CMP_EXIT=0
HELPERS_CMP_EXIT=0
REGISTRATION_CMP_EXIT=0
```

차이 목록은 위의 누락 4개다. 원인은 페이지·Island·레이아웃·진단 및 상태 생성 단계가 아직 JS에 남아 있는 것이다. 기존 JS 빌드를 다시 실행한 결과는 `JS_REGRESSION_EXIT=0`, `Island 테스트 11/11 PASS`, 생성 시각 줄을 제외한 `_app.fl`과 CSS 비교 모두 0이었다.

## 4. 실행 기록과 서버 결과

부분 네이티브 빌드의 실행 결과:

```
NATIVE_EXIT=0
BUILD_FL_ROUTES=113
BUILD_FL_HELPERS=11
NODE_NPM_NPX_JS_PYTHON_EXECVE=0
```

`strace -f -e execve` 원문 발췌. 상위 폴더 경로는 지시대로 가렸다:

```
1076286 execve("<가림>/bin/cgc-bin-x86_64-seed-v11", ["<가림>/bin/cgc-bin-x86_64-seed-v11", "build.fl", "/tmp/tmp.9e0wmqAd8p/build.c"], 0x563803393330 /* 109 vars */) = 0
1076361 execve("/tmp/tmp.9e0wmqAd8p/build", ["/tmp/tmp.9e0wmqAd8p/build"], 0x563803393330 /* 109 vars */) = 0
```

실행된 프로그램 이름은 `as,build,cc1,cgc-bin-x86_64-seed-v11,collect2,cp,dirname,find,gcc,ld,mkdir,mktemp,rm,sh,style-compiler`였다. `_app.fl`이 없어서 네이티브 결과로 v11 서버를 시작하지 않았다. 127.0.0.1의 10개 페이지 HTTP 상태와 HTML 원문 해시는 **미확인**이다. JS 기준 `_app.fl` 자체를 네이티브 cgc에 넣은 별도 확인은 120초 제한으로 종료됐다: `CGC_GOLDEN_EXIT=124`. 이 제한 종료만으로 컴파일 불가능하다고 단정하지 않는다.

## 5. BUILD_FL_SUMMARY

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| a 기준 커밋 | PASS | `92f4f26`, 경로 포함 출력은 SHA-256으로 고정 |
| b 생성 파일 전부 일치 | FAIL | 5개 중 4개 미생성 |
| c Node 0회 전체 빌드 | PARTIAL | 이행 단계의 실행은 0회, 전체 빌드는 미완 |
| d 네이티브 서버에서 10개 페이지 200 | NOT RUN | 실행 가능한 앱 미생성 |
| e 페이지 HTML 해시 일치 | NOT RUN | 같은 이유 |
| f 기존 프론트 시험 | PASS | JS 빌드 종료 0, Island 11/11 |
| g 민감 정보 검사 | PASS | 새 변경의 경로·비로컬 IP·자격 증명 값 검사 0건 |

`BUILD_FL_SUMMARY=3/7 PASS`. 부분 실행의 Node 0회가 전체 빌드 완료를 뜻하지 않는다.

## 6. 남은 Node 단계와 없는 기능

남은 Node 단계: `applyNs`·`resolveLoad`·스타일 블록 제거, 레이아웃 및 내장 헬퍼 주입, `server-fn`·`defstore` 변환, Island 파싱·JS 방출, 페이지 함수 래핑, `_app.fl`·소스맵, 진단·Island 회귀 시험, AGENTS·캐시·빌드 상태 기록.

v11 x86 네이티브 cgc에서 `regex-match`와 `md5` 호출을 각각 시험했을 때 C 생성은 끝났으나 C 컴파일은 실패했다:

```
PRIMITIVES_CGC_EXIT=0
PRIMITIVES_GCC_EXIT=1
implicit declaration of function ‘regex_match’ [-Wimplicit-function-declaration]
implicit declaration of function ‘md5’ [-Wimplicit-function-declaration]
```

파일 I/O·디렉터리 탐색·문자열·JSON·HTTP 서버 기본 기능은 있다. v11 저장소와 가지는 수정하지 않았다.

## 7. 커밋·두 원격 HEAD와 미확인 항목

작업은 지정된 `03a991dbdf10decfc375333d14ee30316c0a6c40`에서 새 `feat/build-fl` 가지로 시작했다. 캡처 규칙 `24740a4dab66f2862fac34dd3a8e1d0042730020`, 경로 비공개 조정 `04a6734034a3d22372ea41c4936025e6069a7f16`, 기준 `92f4f26a373045461791e3703edec75dc5179905`, 부분 네이티브 빌드 `5bc6ed0a4530e7a8c2212a116141ac698202d589`을 커밋했다. 최종 보고서 커밋과 두 원격의 `git ls-remote` 원문은 푸시 후 최종 응답에 남긴다. 문서 안에 문서 자신의 최종 해시를 넣을 수는 없다.

미확인 항목: 네이티브 전체 앱 생성, 10개 이상 페이지의 HTTP 200, JS 결과와 HTML 해시 일치. 기준 `.build-state.json`에는 JS 실행 시각과 소요 시간이 있으며 현재 허용된 생성 시각 한 줄 예외만으로는 바이트 일치를 보장할 수 없다.

전체 새 변경에 대한 커밋 전 민감 정보 검사 원문:

```
SENSITIVE_DIFF_MATCHES=0
NONLOCAL_IP_DIFF_MATCHES=0
CREDENTIAL_VALUE_MATCHES=0
```
