# F-7: 네이티브 빌드를 기본으로

## 1. 단계별 결과

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| 고정 템플릿 분리 | 구현 | Island 런타임과 AGENTS 템플릿을 `templates/`에서 읽도록 변경 |
| 네이티브 기본 빌드 | 구현 | `package.json`의 `build`가 `scripts/build-fl.sh` 실행 |
| JS 기준 빌드 보존 | 구현 | `scripts/build-js-reference.sh`가 기존 JS 빌더를 실행 |
| 두 빌드 비교 | 스크립트 작성, 미검증 | `tests/run-build-compare.sh`; 잠금 충돌로 집계 중단 |
| 페이지 단일 변경 시험 | 미실행 | 무거운 시험 잠금을 얻지 못함 |
| v11 기능 목록 | 기록 | 아래 6항 참조 |

## 2. 고친 곳 (파일:줄)

- `agents-compiler.fl:2`: JS 파일에서 AGENTS 고정 문장을 읽던 코드를 `templates/agents.md` 읽기로 변경.
- `island-emitter.fl:240`: JS 파일에서 Island 런타임을 읽던 코드를 `templates/island-runtime.template` 읽기로 변경.
- `package.json:15`: 기본 `build`와 `start`의 빌드 단계를 네이티브 셸 빌드로 변경.
- `scripts/build-js-reference.sh:1`: 보존된 JS 빌더 실행 진입점을 추가.
- `tests/run-build-compare.sh:1`: 잠금, openat 추적, CSS·앱·문서·섹션·Island 비교를 묶음.

## 3. 비교 원문

```text
FL_V11_ROOT=<가림> tests/run-build-compare.sh
exit=1
```

이 실행은 `flock -n /tmp/fl-heavy.lock` 단계에서 중단되어 빌드 비교 출력이 없습니다. CSS 137, 섹션 113, Island 44, `_app.fl`, `AGENTS.md`의 일치 여부는 미확인입니다.

## 4. strace·openat 원문

실제 네이티브 빌드가 시작되지 않아 `strace` 원문은 생성되지 않았습니다. `.js` 파일 openat 횟수는 미확인입니다.

## 5. NATIVE_DEFAULT_SUMMARY

```text
NATIVE_DEFAULT_SUMMARY=미검증 (6개 중 0개 확인 완료)
```

빌드 실행·openat, 전체 비교, 단일 페이지 변경, JS·Island 회귀 및 민감 정보 검사를 아직 완료하지 못했습니다. `sh -n`과 커밋 diff 공백 검사는 종료 코드 0입니다.

## 6. v11에 필요한 기능 목록 (누적)

- `regex_match`
- `md5`
- `try`
- `template-string`
- 소수 출력: `273.15`가 `273.14999999999998`로 직렬화되는 문제

v11 저장소는 수정하지 않았습니다.

## 7. 커밋·두 원격 HEAD + 미확인 항목

구현 커밋: `f3abb98`, 비교 스크립트 구문 수정: `8cfdebd`, 보고서: `ffd0ba4`, 런타임 템플릿 범위 수정: `565538b`. 마지막 보고서 갱신 전 두 원격 HEAD는 `565538b`였고, 이 보고서 커밋도 Forgejo 다음 GitHub 순으로 푸시했습니다. 최종 커밋과 원격 HEAD는 응답에 기록했습니다.

미확인: F-7의 런타임 비교와 6개 요약 항목. 잠금 보유 프로세스가 있어 지정한 73 접속을 시도했으나 연결이 시간 초과됐습니다. 23·25에는 접속하지 않았습니다.
