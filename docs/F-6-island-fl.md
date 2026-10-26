# F-6: Island 출력기와 AGENTS.md 네이티브 이행 기록

## 1. 단계별 이행 결과

| 단계 | 결과 | 검증 |
| --- | --- | --- |
| Island 블록 추출·S식 파싱 | 완료 | Island가 있는 44개 페이지의 AST 구조 44/44 일치 |
| 브라우저용 JS 출력 | 완료 | 44개 페이지의 컴파일된 스크립트 바이트 44/44 일치 |
| 페이지 내 placeholder·store·CSS 주입 | 완료 | 전체 페이지 섹션 113/113 바이트 일치 |
| `_app.fl` 생성 | 완료 | 생성 시각 2행만 뺀 전체 바이트 일치 |
| `AGENTS.md` 생성 | 완료 | 기존 파일과 19553바이트 그대로 일치; 제외한 줄 없음 |
| Node 없는 빌드 | 완료 | 최종 `strace`에서 Node·npm·npx·JS·Python 실행 0회 |

Island 파서와 JS 출력기는 FreeLang으로 작성했다. 브라우저 Island 런타임의 고정 문자열은 보존된 `island-compiler.js`에서 FreeLang `file-read`로 읽고 템플릿 이스케이프를 처리한다. `AGENTS.md`의 고정 문장도 보존된 `fl-front-build.js`에서 읽고 라우트·헬퍼 목록은 FreeLang이 생성한다. 두 JS 파일은 빌드 중 실행하지 않는다. 기존 기준 파일은 수정하지 않았다.

AST 비교는 JSON을 파싱해 구조와 값으로 대조했다. v11 JSON 직렬화가 숫자 `273.15`를 `273.14999999999998`로 쓰는 사례가 있어 AST JSON 원문 바이트는 비교 대상이 아니다. 최종 브라우저 JS와 `_app.fl`은 원문 바이트로 비교했다.

## 2. 고친 곳 (파일:줄)

- `island-compiler.fl:18`, `island-compiler.fl:62`, `island-compiler.fl:88`: 원자·문자열·리스트·맵 파싱과 Island 블록 추출. `island-compiler.fl:96`: 비교용 AST 산출.
- `island-emitter.fl:37`, `island-emitter.fl:99`, `island-emitter.fl:124`, `island-emitter.fl:223`: JS 식·Island 렌더 함수·마운트 스크립트 생성. `island-emitter.fl:240`, `island-emitter.fl:270`, `island-emitter.fl:297`, `island-emitter.fl:326`: 고정 런타임, store 초기화, placeholder 및 CSS 결합.
- `agents-compiler.fl:2`, `agents-compiler.fl:9`, `agents-compiler.fl:42`, `agents-compiler.fl:76`: 기존 문서 템플릿을 읽고 라우트·헬퍼·타입 목록을 네이티브로 생성.
- `build.fl:3`–`5`, `build.fl:145`, `build.fl:172`, `build.fl:224`–`226`: 위 변환기를 전체 빌드에 연결하고 `_app.fl`·`AGENTS.md` 기록.
- `scripts/build-fl.sh:9`: Island AST·스크립트 비교 산출물 디렉터리 준비.
- `tests/build-golden/compare-island-ast.sh:1`, `tests/build-golden/compare-island-scripts.sh:1`: 비교 집계. 각각 첫 실행 전에 `1f7a682` 및 `1a52e2d`로 커밋했고, AST 비교 방식 수정도 실행 전에 `452548b`, `b624c61`로 커밋했다. 실행 중 스크립트를 수정하지 않았다.

## 3. 비교 결과 원문

기준 `_app.fl`과 `app.css`의 SHA-256은 F-4·F-5와 동일하다:

```
c6f3404e5248cc42e4971dd06b1242111e826329517c251065b553dfd12772ad  tests/build-golden/_app.fl
dcd2bb1ca7ec6ba712a24d007984763a4d41f0b24a703a937ab88ce753a6058b  tests/build-golden/app.css
STYLE_CMP_FILES=137
STYLE_CMP_EXIT=0
STYLE_REMOVAL_TOTAL=135
STYLE_REMOVAL_MATCHED=135
STYLE_REMOVAL_DIFFERENT=0
REFERENCE_JS_EXIT=0
PRE_ISLAND_TOTAL=113
PRE_ISLAND_MATCHED=113
PRE_ISLAND_DIFFERENT=0
ISLAND_AST_TOTAL=44
ISLAND_AST_MATCHED=44
ISLAND_AST_DIFFERENT=0
ISLAND_SCRIPT_TOTAL=44
ISLAND_SCRIPT_MATCHED=44
ISLAND_SCRIPT_DIFFERENT=0
SECTION_TOTAL=113
SECTION_MATCHED=113
SECTION_MISSING=0
SECTION_DIFFERENT=0
APP_CMP_EXIT=0
AGENTS_CMP_EXIT=0
CSS_CMP_EXIT=0
  ✅ Island 테스트 11/11 PASS
```

`cmp`는 일치 시 표준 출력이 없고 종료 코드 0이었다. `_app.fl`은 기준과 네이티브 출력의 2행 `; 생성:`만 제거해 비교했다. `AGENTS.md`에는 제외 규칙이 없다. `AGENTS.md`의 SHA-256 원문:

```
ceca6628bfb98bcee4203d5c010ffd473ad85df7357feb0e8671c61d8443edb9  AGENTS.md
ceca6628bfb98bcee4203d5c010ffd473ad85df7357feb0e8671c61d8443edb9  tests/build-actual/AGENTS.md
```

## 4. strace 원문

최종 코드로 `strace -f -e execve`를 실행했다. 아래 줄에서 상위 폴더 경로만 `<가림>`으로 치환했다:

```
3009190 execve("<가림>/bin/cgc-bin-x86_64-seed-v11", ["<가림>"..., "style-compiler.fl", "/tmp/tmp.SXppexair1/style-compil"...], 0x5563f21603c0 /* 109 vars */) = 0
3009267 execve("/tmp/tmp.SXppexair1/style-compiler", ["/tmp/tmp.SXppexair1/style-compil"...], 0x5563f21603c0 /* 109 vars */) = 0
3009271 execve("<가림>/bin/cgc-bin-x86_64-seed-v11", ["<가림>"..., "build.fl", "/tmp/tmp.x9MCcSFmM3/build.c"], 0x5615fb97f330 /* 109 vars */) = 0
NATIVE_FINAL_EXIT=0
BUILD_FL_ROUTES=113
BUILD_FL_HELPERS=11
BUILD_FL_ISLAND_PAGES=44
NODE_NPM_NPX_JS_PYTHON_EXECVE=0
```

실행된 프로그램 이름은 `as,build,cc1,cgc-bin-x86_64-seed-v11,collect2,cp,dirname,env,find,gcc,ld,mkdir,mktemp,rm,sh,style-compiler`다. JS 기준 생성은 별도 회귀 시험에서 실행했으며, 위 네이티브 빌드 감시 결과에 섞지 않았다.

## 5. ISLAND_FL_SUMMARY

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| a Island 섹션 44/44 | PASS | 스크립트 44/44, 전체 섹션 113/113 |
| b `_app.fl` 전체 일치 | PASS | 생성 시각 2행 제외 `APP_CMP_EXIT=0` |
| c `AGENTS.md` 일치 | PASS | `AGENTS_CMP_EXIT=0`, SHA-256 동일 |
| d 네이티브 빌드 실행 0회 | PASS | 최종 `strace`에서 지정 프로그램 0회 |
| e JS·Island 및 F-3·F-5 비교 | PASS | Island 11/11, CSS 137개, Island 직전 113개, 전체 섹션 113개 |
| f 민감 정보 검사 | PASS | 커밋 전 전체 F-6 변경 검사 0건 |

`ISLAND_FL_SUMMARY=6/6 PASS`.

## 6. v11에 필요한 기능 목록 (누적)

이번 F-6의 빌드 단계는 현 x86 네이티브 도구로 실행됐으며 새로 필요한 v11 기능은 확인되지 않았다. 이전 작업에서 확인한 `regex_match`, `md5` 부재와 앱 실행용 x86 C 백엔드의 `try`, `template-string`, 일부 리터럴·심볼 처리 문제는 남아 있다. 서버 실행 확인은 지시서대로 이번 범위에서 제외했고 v11 저장소는 수정하지 않았다. 앱 소스의 네이티브 C 컴파일·서버 실행 가능 여부를 이번 결과로 주장하지 않는다.

## 7. 커밋·두 원격 HEAD와 미확인 항목

`feat/build-fl`의 지정 시작점 `3e2165194713ceca3754ac8abb236efda4c26f06`에서 이어 작업했다. 비교 도구 `1f7a682`, `452548b`, `b624c61`, `1a52e2d`, 변환기 `54374e7`, 괄호 수정 `0ffe6b6`을 커밋했다. 보고서 작성 직전 구현 커밋의 `git ls-remote` 원문:

Forgejo:

```
0ffe6b6f68462d1cafe7248a7cbd8cbfe0087fb6	refs/heads/feat/build-fl
```

GitHub:

```
0ffe6b6f68462d1cafe7248a7cbd8cbfe0087fb6	refs/heads/feat/build-fl
```

보고서 자체의 최종 커밋과 두 원격의 최신 HEAD는 푸시 후 최종 응답에 남긴다. 문서에 자신의 최종 커밋 해시를 넣을 수는 없다. 미확인 항목은 v11 서버 실행이며 이번 지시서에서 제외됐다.

커밋 전 전체 F-6 변경의 민감 정보 검사 원문:

```
HOME_PATH_MATCHES=0
SERVER_ADDRESS_MATCHES=0
NONLOCAL_IP_MATCHES=0
CREDENTIAL_VALUE_MATCHES=0
```
