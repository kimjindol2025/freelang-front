# F-7 재검증 결과

실행 위치: 메인

## 1. 단계별 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| a `.js` openat | PASS | `JS_OPENAT_COUNT=0`; 실제 `.js"` 경로 일치 원문 0행 |
| b 기본 네이티브 빌드와 런타임 | PASS | 빌드 종료 0; Node/npm/npx/JS/Python 실행 0 |
| c 비교 집계 | PASS | CSS 137, section 113/113, Island 44/44, `_app.fl`, `AGENTS.md` 일치 |
| d 단일 페이지 변경 | PASS | 전체 재빌드 후 `pages/about.flx` section만 변경 |
| e JS 기준 빌드·Island | PASS | JS 기준 빌드 종료 0, Island 11/11 PASS |
| f 민감 정보 검사 | PASS | 네 검사 결과 모두 0 |

`NATIVE_DEFAULT_SUMMARY=6/6 PASS`

## 2. 고친 곳 (파일:줄)

실패 원인은 AGENTS 템플릿의 라우트 표와 네이밍 규칙 사이 빈 줄 누락, 비교 스크립트의 `.js` 부분 문자열 검색이 `.json`까지 세고 실패 상태를 요약에 반영하지 않은 점입니다.

- `templates/agents.md:139`: 라우트 표 뒤의 빈 줄 복원.
- `tests/run-build-compare.sh:11`: `.js"`로 확장자 끝을 확인하도록 수정.
- `tests/run-build-compare.sh:23`: 불일치나 `.js` open이 있으면 실패하도록 수정.

수정 커밋 `ecbde70`에 반영한 뒤 해당 비교를 다시 실행했습니다.

## 3. 비교 원문

```text
CSS_MATCH=1
APP_MATCH=1
AGENTS_MATCH=1
JS_OPENAT_COUNT=0
STYLE_CMP_FILES=137
STYLE_CMP_EXIT=0
SECTION_TOTAL=113
SECTION_MATCHED=113
SECTION_MISSING=0
SECTION_DIFFERENT=0
ISLAND_SCRIPT_TOTAL=44
ISLAND_SCRIPT_MATCHED=44
ISLAND_SCRIPT_DIFFERENT=0
BUILD_CMP_SUMMARY=5/5
```

## 4. strace·openat 및 실행 원문

```text
NATIVE_BUILD_EXIT=0
JS_OPENAT_COUNT=0
FORBIDDEN_EXECVE_COUNT=0
EXECUTED_NAMES=as,build,cc1,cgc-bin-x86_64-seed-v11,collect2,cp,dirname,find,gcc,ld,mkdir,mktemp,rm,sh,style-compiler,
```

`.js"`를 포함한 openat 원문 행은 0개였습니다. 기본 빌드 추적에서 Node, npm, npx, `.js` 실행 파일, Python 실행은 없었습니다.

## 5. 단일 페이지 변경 원문

md5 캐시 없이 네이티브 전체 빌드를 다시 실행했습니다. `pages/about.flx`에 임시 주석 한 줄을 추가한 뒤의 결과:

```text
SECTION_CHANGED=pages/about.flx
SECTION_CHANGED_COUNT=1
```

임시 변경과 빌드 상태 파일은 시험 직후 복구했습니다.

## 6. JS 기준 빌드·민감 정보 검사 원문

```text
JS_REFERENCE_EXIT=0
  \u001b[32m✅ Island JS 문법 정상\u001b[0m
  \u001b[32m✅ Island 테스트 11/11 PASS\u001b[0m
HOME_PATH_MATCHES=0
SERVER_ADDRESS_MATCHES=0
NONLOCAL_IP_MATCHES=0
CREDENTIAL_VALUE_MATCHES=0
```

민감 정보 검사는 F-7 변경 diff의 추가 행에 대해 실행했습니다.

## 7. 커밋·두 원격 HEAD 및 미확인 항목

재검증 수정 HEAD `ecbde70`과 첫 보고서 게시 커밋 `29b5da98e6cbf89681c7af0f726fd7170d349b76`을 Forgejo 먼저, GitHub 다음 순으로 푸시했습니다. 첫 게시 확인 당시 두 원격 HEAD는 모두 `29b5da98e6cbf89681c7af0f726fd7170d349b76`이었습니다. 이후 보고서 기록 커밋과 최종 HEAD는 응답에 기록합니다.

미확인 항목: 없음. 23·25 서버와 v11 저장소에는 접속하거나 수정하지 않았습니다.
