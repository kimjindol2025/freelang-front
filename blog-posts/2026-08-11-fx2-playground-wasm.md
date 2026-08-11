# fx2 Playground에서 브라우저 WASM smoke까지: 단계별 구현 기록

작성일: 2026-08-11

이 글은 fx2 언어 체크 프론트와 WASM 실험을 실제 저장소 변경 순서대로 기록한 작업 일지다. 성공한 결과뿐 아니라 중간에 발견한 실패와 아직 남은 경계도 함께 적는다.

## 1단계 — fx2 Playground 뼈대 만들기

처음 목표는 브라우저에서 fx2 코드를 입력하고 서버에서 네이티브 검사 결과를 받는 흐름이었다.

추가한 흐름은 다음과 같다.

```text
브라우저 입력
  → POST /api/check
  → fx2 서버가 소스 저장
  → fl-build.sh 네이티브 검사
  → JSON 결과 반환
```

초기 구현은 `/tmp`의 고정 파일을 사용했다. 단일 사용자 smoke에는 충분했지만 동시에 요청이 들어오면 소스와 로그가 서로 덮어써질 수 있었다.

관련 커밋:

- `3691010 feat: add fx2 playground scaffold and language handoff`
- `2b12dc9 fix: make fx2 playground run native checks`

## 2단계 — compiler의 process-run 연결

Playground가 검사 명령을 실행하려면 fx2 compiler가 `process-run`을 실제 네이티브 호출로 내보내야 했다. 기존에는 빈 문자열 stub이 선택되어 생성 C 코드에 실행 함수가 연결되지 않았다.

compiler의 `self/codegen-c.fl`과 생성 산출물 `self/all-c.fl`에 다음 매핑을 추가했다.

```text
process-run → _fl_process_run(<command>)
```

그 결과 네이티브 smoke 프로그램이 `native-process-ok`를 출력했다.

관련 커밋:

- `3fd5670c fix: enable native process-run codegen`

## 3단계 — cgc 배포 바이너리 갱신

compiler 소스를 수정하는 것만으로는 fx2의 기본 실행 환경이 바뀌지 않았다. native cgc를 다시 빌드하고 `bin/cgc-bin`을 갱신했다.

처음 fx2 빌드가 실패한 원인은 ARM 환경에서 오래된 `cgc-bin.bak`을 최신 `cgc-bin`보다 먼저 선택하고 있었기 때문이다.

수정 내용:

- ARM에서도 `/root/freelang-v11/bin/cgc-bin`을 먼저 선택
- 기본 cgc 바이너리 재생성
- compiler 저장소에 배포 바이너리 커밋

관련 커밋:

- `607d1b4f build: refresh native cgc binary`

## 4단계 — Playground 실행 안전성 보강

고정 임시 파일 문제를 요청별 작업공간으로 바꿨다.

현재 검사 요청은 다음 제한을 가진다.

- 요청별 `mktemp` 작업공간
- 요청별 소스·로그·실행 파일
- 소스 최대 1MB
- 실행 시간 15초
- 동시 검사 최대 8개
- `--no-net` 빌드
- 요청 종료 후 작업공간 정리
- 서버 시작 시 warmup 빌드

HTTP 응답 상태도 결과에 맞춰 분리했다.

| 상황 | 상태 |
|---|---:|
| 검사 성공 | 200 |
| 소스 크기 초과 | 413 |
| 컴파일 오류 | 422 |
| 동시 요청 초과 | 429 |
| 15초 timeout | 408 |

여기서 두 가지 문제가 추가로 드러났다.

첫째, `--no-net`으로 서버 자체를 빌드하면 HTTP 런타임도 stub이 되어 서버가 바로 종료된다. 따라서 서버 검증은 일반 런타임으로 하고, 사용자 코드 검사는 `--no-net`으로 분리했다.

둘째, 첫 요청이 compiler warmup 때문에 15초를 넘었다. 서버 시작 시 작은 warmup 빌드를 한 번 수행하는 방식으로 해결했다.

관련 커밋:

- `a0681db fix: harden fx2 playground checks`

## 5단계 — HTTP smoke 검증

일반 HTTP 런타임으로 실제 서버를 빌드한 뒤 다음 요청을 확인했다.

- `(println "ok")` → HTTP 200
- 존재하지 않는 함수 → HTTP 422
- JSON 응답에 `ok`, `output`, `exit`, `request_id`, `status` 포함

1MB 테스트에서는 fx2 HTTP 파서 자체가 약 64KB에서 본문을 잘라내는 추가 경계도 확인됐다. 따라서 애플리케이션의 1MB 검사는 존재하지만, 현재 배포 런타임에서는 실제 HTTP 입력이 그보다 먼저 제한된다.

## 6단계 — 핵심 런타임 WASM smoke

처음 환경에는 `emcc`, `wasm2wat`, `binaryen`이 없었다. 시스템 패키지를 설치한 뒤 기존 `runtime/test_runtime.c`를 OpenSSL·네트워크 없이 WASM으로 빌드했다.

재현 명령:

```bash
bash tools/build-wasm-runtime.sh /tmp/fx2-wasm
```

검증 결과:

```text
All tests PASS
WASM runtime smoke passed
```

이 단계에서 실제로 검증된 범위는 값, 산술, 문자열, 벡터, 맵, JSON과 기본 런타임 동작이다. 전체 fx2 compiler를 WASM으로 옮긴 것은 아니다.

관련 커밋:

- `4b59ac6 feat: add wasm runtime smoke build`

## 7단계 — 브라우저용 WASM API와 DOM 어댑터

브라우저에서 호출할 수 있도록 `fx2_wasm_smoke()` export를 만들고, 다음 JavaScript 어댑터를 추가했다.

- `ready`
- `smoke()`
- `onClick(selector, handler)`
- `onInput(selector, handler)`

브라우저 패키지는 다음 명령으로 만든다.

```bash
bash tools/build-wasm-browser.sh /tmp/fx2-wasm-browser
```

실제 headless 브라우저는 환경에 설치되어 있지 않아 Node에서 같은 WASM API를 호출하고, 생성된 JS 문법과 WASM → WAT 변환을 검증했다.

검증 결과:

```text
browser smoke API passed
browser-artifact-valid
```

관련 커밋:

- `8fbdb35 feat: add browser wasm smoke target`
- `408146d feat: add wasm browser adapter`

## 현재 결과

현재 fx2에는 다음이 연결되어 있다.

```text
fx2 코드 입력
  → 안전한 네이티브 검사 API
  → process-run 기반 compiler 연결
  → 갱신된 cgc 배포 바이너리
  → 핵심 런타임 WASM smoke
  → 브라우저 WASM 호출 API
  → 최소 DOM 이벤트 어댑터
```

## 남은 일

아직 완료되지 않은 항목은 명확하다.

1. 실제 headless 브라우저에서 HTML smoke 실행
2. fx2 compiler 자체의 WASM 출력 타깃
3. 브라우저용 메모리·문자열 런타임 정리
4. `fetch`, Promise, 오류 위치 변환
5. DOM 바인딩을 compiler 언어 기능으로 승격
6. HTTP 파서의 64KB 본문 제한과 애플리케이션 1MB 제한 정합성 확보

따라서 현재 상태는 “전체 fx2 웹/WASM 완성”이 아니라, 네이티브 검사기와 런타임 WASM을 실제로 빌드하고 브라우저 연결 계층까지 확인한 1차 수직 슬라이스다.
