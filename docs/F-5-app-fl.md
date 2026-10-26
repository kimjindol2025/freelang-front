# F-5: `_app.fl` 네이티브 생성 이행 기록

## 1. 단계별 이행 결과

| 단계 | 결과 | 비교 근거 |
| --- | --- | --- |
| 기준 보존 | F-4의 `tests/build-golden/` 그대로 사용 | `_app.fl`, CSS SHA-256 불변 |
| 정규식 대체: 스타일 블록 제거 | 135개 `.flx` 일치 | JS `removeStyleBlocks`와 `cmp` |
| 정규식 대체: `applyNs`, `resolveLoad`, `server-fn`, `defstore`, 레이아웃 CSS | Island 처리 직전 113개 페이지 전부 일치 | 기존 JS 소스를 메모리에서 계측한 기준과 `cmp` |
| 내장 헬퍼·스타일 바인딩·레이아웃 | 첫 페이지 전 공통 본문 일치 | 생성 시각 2행을 뺀 접두부 `cmp` 0 |
| 페이지 함수 래핑 | Island 없는 69개 페이지 섹션 일치 | JS 기준 `_app.fl`에서 추출한 섹션과 `cmp` |
| Island 파서·브라우저 JS 출력 | 미이행 | 44개 페이지의 Island 블록이 네이티브 출력에 원문으로 남음 |
| `_app.fl` 전체 | 생성했으나 불일치 | 최초 차이 163874바이트·3655행, Island 페이지 시작점 |
| 캐시·상태·AGENTS | `md5` 캐시와 `build-state.json`은 이번 비교에서 제외. `AGENTS.md`는 미생성 | 캐시의 경로별 MD5와 상태의 실행 시각·소요 시간은 전체 빌드 이행 범위 밖. `AGENTS.md` 생성 이행은 남음 |

Island가 남은 페이지는 44개다. `pages/app/index.flx`, `pages/index.flx`, `pages/notes-island.flx` 등이며 전체 목록은 네이티브 빌드 산출물 `tests/build-actual/island-pages.txt`에 기록된다. 이 파일은 비교용 임시 산출물이다. 현재 `_app.fl`은 Island가 있는 44개 페이지를 실행 가능한 형태로 변환하지 못한다.

## 2. 고친 곳 (파일:줄)

- `build-transforms.fl:25`: 문자열·삼중따옴표의 괄호를 건너뛰며 스타일 블록 제거. `build-transforms.fl:82`, `build-transforms.fl:107`: 네임스페이스 이름 변경과 load 인라인. `build-transforms.fl:132`, `build-transforms.fl:143`, `build-transforms.fl:166`, `build-transforms.fl:181`, `build-transforms.fl:192`: 저장소 정의 제거, 서버 함수·레이아웃 CSS·페이지 함수 래핑.
- `build.fl:105`–`174`: CSS 바인딩, 페어 CSS, 헬퍼, 페이지 본문을 결합하고 단계별 비교 산출물을 기록. `build.fl:188`–`218`: 정적 템플릿과 라우트 등록문을 합쳐 `_app.fl` 생성.
- `style-compiler.fl:224`, `style-compiler.fl:295`: F-3 변환기의 바인딩 순서를 네이티브 빌드에 전달.
- `templates/injected-helpers.fl:1`, `templates/base.css:1`: 기존 JS 빌더에 있던 고정 템플릿을 그대로 추출해 보관.
- `tests/build-golden/compare-style-removal.sh:1`, `tests/build-golden/compare-sections.sh:1`, `tests/build-golden/compare-pre-island.sh:1`: 단계별 바이트 비교. 집계 스크립트는 실행 전에 각각 `3f1f878`, `71df042`, `3851cc9`로 커밋했다. 실행 중 수정하지 않았다.
- `scripts/build-fl.sh:1`: 네이티브 실행과 비교 산출물 디렉터리 준비.

## 3. 비교 원문

기준 해시는 F-4와 동일하다. 기준 파일은 수정하지 않았다.

```
c6f3404e5248cc42e4971dd06b1242111e826329517c251065b553dfd12772ad  tests/build-golden/_app.fl
dcd2bb1ca7ec6ba712a24d007984763a4d41f0b24a703a937ab88ce753a6058b  tests/build-golden/app.css
STYLE_REMOVAL_TOTAL=135
STYLE_REMOVAL_MATCHED=135
STYLE_REMOVAL_DIFFERENT=0
REFERENCE_JS_EXIT=0
PRE_ISLAND_TOTAL=113
PRE_ISLAND_MATCHED=113
PRE_ISLAND_DIFFERENT=0
PREFIX_FINAL_CMP_EXIT=0
SECTION_TOTAL=113
SECTION_MATCHED=69
SECTION_MISSING=0
SECTION_DIFFERENT=44
/tmp/f5-golden-normalized /tmp/f5-final-app differ: byte 163874, line 3655
APP_FINAL_CMP_EXIT=1
CSS_FINAL_CMP_EXIT=0
JS_APP_CMP_EXIT=0
JS_CSS_CMP_EXIT=0
```

113개 중 다른 섹션 44개는 모두 Island 페이지다. Island가 없는 페이지의 다른 섹션은 0개다. 전체 `_app.fl`의 차이 원인은 Island 파서·브라우저 JS 출력기를 아직 옮기지 않은 것이다. 생성 시각 2행만 전체 파일 비교에서 제거했다. CSS는 기존 기준과 바이트 일치한다.

## 4. 네이티브 실행과 서버 결과

`strace -f -e execve`로 `scripts/build-fl.sh`를 감시했다. 상위 폴더 경로는 지시대로 `<가림>`으로 바꿨다. 실행 기록 발췌:

```
1146070 execve("<가림>/bin/cgc-bin-x86_64-seed-v11", ["<가림>"..., "style-compiler.fl", "/tmp/tmp.frYo8Tbs9U/style-compil"...], 0x55860cd813c0 /* 109 vars */) = 0
1146262 execve("/tmp/tmp.frYo8Tbs9U/style-compiler", ["/tmp/tmp.frYo8Tbs9U/style-compil"...], 0x55860cd813c0 /* 109 vars */) = 0
1146266 execve("<가림>/bin/cgc-bin-x86_64-seed-v11", ["<가림>"..., "build.fl", "/tmp/tmp.7UD6RvvAhE/build.c"], 0x55db94197330 /* 109 vars */) = 0
STRACE_BUILD_EXIT=0
NODE_NPM_NPX_JS_PYTHON_EXECVE=0
BUILD_FL_ROUTES=113
BUILD_FL_HELPERS=11
BUILD_FL_ISLAND_PAGES=44
```

600초 제한을 사용한 v11 x86 C 생성·컴파일 결과 원문:

```
CGC_GOLDEN_EXIT=0
CGC_GOLDEN_ELAPSED=286.97 s
CGC_C_COMPILE_EXIT=1
CGC_C_COMPILE_ELAPSED=4.57 s
CGC_NATIVE_EXIT=0
CGC_NATIVE_ELAPSED=122.91 s
CGC_NATIVE_C_EXIT=1
CGC_NATIVE_C_ELAPSED=7.33 s
[CGC-ERR] unsupported IR kind=template-string
[CGC-ERR] unsupported IR kind=try
[CGC-ERR] unsupported literal type=unknown
```

JS 기준과 네이티브 출력 모두 C 생성은 완료했지만, 생성된 C를 `gcc`가 컴파일하지 못했다. 예를 들어 네이티브 C 출력에서 `error: expected ‘;’, ‘,’ or ‘)’ before ‘&’ token`이 발생했다. 실행 파일이 없으므로 127.0.0.1 서버 시작, 10개 이상 페이지 HTTP 200, HTML 원문 해시 비교는 **미확인**이다. 120초 제한 종료를 다시 사용하지 않았으며 실제 C 생성 소요 시간은 위와 같다.

## 5. BUILD_FL2_SUMMARY

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| a 정규식 대체 결과 일치 | PASS | 스타일 제거 135/135, 전체 페이지 Island 직전 113/113 |
| b `_app.fl` 바이트 일치 | FAIL | Island 섹션 44개 차이 |
| c Node 0회 전체 빌드 | PARTIAL | 실행한 네이티브 빌드는 0회이나 Island 출력이 미완 |
| d 네이티브 서버 페이지 10개 이상 200 | NOT RUN | v11 C 컴파일 실패 |
| e HTML 해시 일치 | NOT RUN | 서버 실행 불가 |
| f 기존 JS 빌드·Island 11/11 | PASS | `REFERENCE_JS_EXIT=0`, `Island 테스트 11/11 PASS`, JS 기준 앱·CSS 비교 0 |
| g 민감 정보 검사 0건 | PASS | 아래 커밋 전 전체 변경 검사 원문 |

`BUILD_FL2_SUMMARY=3/7 PASS`. Island 미이행 페이지는 44개다. 실행한 네이티브 경로의 Node 0회는 완성된 전체 빌드를 뜻하지 않는다.

## 6. v11에 필요한 기능과 남은 작업

기존 확인된 `regex_match`, `md5` 외에, 현재 x86 C 백엔드는 앱 소스의 `try`, `template-string`, 일부 리터럴에서 지원하지 않는 IR을 보고한다. 생성 C에는 문법 오류와 심볼 충돌·미정의 호출도 있다. 이는 JS 기준 `_app.fl`을 넣어도 재현된다. 실행 가능한 서버를 위해 이 C 백엔드 문제를 해결할 기능이 필요하지만, 지시대로 v11 저장소는 수정하지 않았다. `bin/fl`은 이 환경에서 실행할 수 없는 ARM ELF이며, Node 기반 실행 경로는 이번 네이티브 검증에 사용하지 않았다.

프론트 쪽 남은 일은 Island 파서와 브라우저 JS 출력기를 FreeLang으로 옮기고 44개 섹션을 다시 비교하는 것이다. `AGENTS.md` 생성도 남았다. MD5 캐시 `.build-cache.json`은 이번에 생략했고, `.build-cache.json`과 실행 시각·소요 시간이 들어가는 `build-state.json`은 비교 대상에서 제외했다. `defstore`의 중첩 괄호 초기값은 현재 입력에는 없으며, 새로 등장하면 균형 괄호 스캐너가 필요하다.

## 7. 커밋·두 원격 HEAD와 미확인 항목

`feat/build-fl`의 `bcedc3e6`에서 이어 작업했다. F-5 비교 스크립트 커밋은 `71df042`, `3f1f878`, 이행 커밋은 `3851cc9`, 제한 주석 커밋은 `063996f`이다. 보고서 작성 직전 구현 커밋의 두 원격 HEAD를 확인했다. `git ls-remote` 원문:

Forgejo:

```
063996f6145a56937abfa17fd8595f332d1753be	refs/heads/feat/build-fl
```

GitHub:

```
063996f6145a56937abfa17fd8595f332d1753be	refs/heads/feat/build-fl
```

보고서 커밋 후 최신 원격 HEAD는 최종 응답에 기록한다. 문서 안에 자신의 최종 커밋 해시를 넣을 수는 없다.

미확인 항목: Island 44개 페이지의 동작, 네이티브 서버 10개 페이지 상태·HTML 해시, `AGENTS.md` 생성. 기존 JS 빌드와 기준 파일은 유지했다.

커밋 전 전체 F-5 변경의 민감 정보 검사 원문:

```
HOME_PATH_MATCHES=0
SERVER_ADDRESS_MATCHES=0
NONLOCAL_IP_MATCHES=0
CREDENTIAL_VALUE_MATCHES=0
```
