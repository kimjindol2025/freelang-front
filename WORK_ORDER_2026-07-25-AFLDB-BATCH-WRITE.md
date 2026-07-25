# 업무지시서 — afl-db batch write 경로 정리

**작성일**: 2026-07-25 KST  
**역할**: Cursor 구현자 · Codex 팀장 검수  
**집행 근거**: kim 지시 — FreeLang이 front에 약한 지점을 `freelang-front` 도구층/진단층/런타임 helper로 보강한다. HTTP-INPROCESS 이후 남은 병목은 요청 1회 비용보다 **콜 횟수**다.

## 착수 해석 관문

시작 전에 네가 이해한 목적지를 한 줄로 먼저 남겨라.  
어긋나면 구현하지 말고 지시서를 고친다.

## 목적지

afl-db 컬렉션 write 경로에서 불필요한 순차 HTTP 호출을 줄인다.

이번 작업의 부산은 다음이다.

- `afldb-coll-create` / `update` / `delete` 중 실제로 줄일 수 있는 경로를 먼저 측정해 찾는다.
- 가능한 경로는 기존 afl-db 계약을 깨지 않고 batch write로 정리한다.
- 불가능한 경로는 왜 못 줄이는지 문서에 남긴다.
- `/clips/api` add+delete 성능과 build 검증을 실측으로 보고한다.
- 후보 목록은 새로 착수하지 않는다.

## 현재 기준선

착수 시점에 반드시 다시 재확인한다.

```bash
git status --short --branch
git log --oneline -5 --decorate
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node scripts/perf-afldb.js --json
```

빌드 보고는 `summary.warnings`만 쓰지 말고 다음을 함께 적는다.

- `summary.stdlibLoadOk`
- `summary.stdlibLsFnsCount`
- `summary.stdlibLoadError` 유무

## 금지선

- 작업 저장소: `/home/kim/kim/skl/freelang-front`
- FreeLang 코어, VM, `runtime/bootstrap.js` HTTP-INPROCESS 구현 변경 금지.
- afl-db backend 자체 변경 금지. front helper/API 조합만 다룬다.
- DB 데이터 대량 정리, 로그 압축, `/verify` 정책 변경 금지.
- `logs/` 커밋 금지.
- `.build-state.json`은 검증 부산물이다. 별도 이유 없으면 커밋하지 않는다.
- `git add -A` 금지. 의도한 파일만 stage.
- APP-DB rename, undefined-fn/route-shadow 일괄, 진단 커버리지 확대는 착수 금지.
- push는 사용자 확인 후에만 한다.

## 작업 범위

### 1. 콜 횟수 기준선 기록

`pages/_afldb.flx`, `pages/_afldb_coll.flx`, `pages/clips/*` 기준으로 현재 write 경로의 HTTP 호출 수를 표로 적는다.

최소 포함:

- create
- update
- delete
- clips add
- clips delete
- clips add+delete roundtrip

실측은 `scripts/perf-afldb.js --json`을 사용한다. 필요하면 측정 스크립트에 `composition_hint`만 보강해도 된다.

### 2. batch write 적용 가능성 판단

`afldb-batch-put`으로 줄일 수 있는 경우만 구현한다.

판단 기준:

- 같은 의미의 `put` 여러 개가 이미 존재하는 경우 → batch 후보
- 기존 값을 읽어야 다음 값을 만들 수 있는 경우 → read는 남겨도 됨
- backend에 없는 batch delete를 가정하지 말 것
- tombstone/soft delete로 의미를 바꾸지 말 것
- item 저장과 index 저장의 순서 변경이 사용자에게 보이는 의미를 바꾸면 보류

### 3. 구현

구현 위치는 우선 다음 중 하나로 제한한다.

- `pages/_afldb.flx`
- `pages/_afldb_coll.flx`
- 필요한 경우 `scripts/perf-afldb.js`
- 필요한 경우 `docs/AFLDB-COLL.md`, `docs/TRAPS.md`, `docs/AI-INTERFACE-ROADMAP.md`

새 helper를 추가한다면 이름과 계약을 문서에 남긴다.  
기존 helper 의미를 바꾼다면 기존 앱 5종이 영향을 받는지 확인한다.

### 4. 회귀 검증

필수 검증:

```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
node scripts/perf-afldb.js --json
curl -sS http://127.0.0.1:40860/clips/api
```

write 검증:

- clips add 후 응답 목록에 새 item이 있다.
- delete 후 같은 id가 목록에서 사라진다.
- add+delete probe가 잔여 데이터를 남기지 않는다.
- `afldb-coll-known`에 기존 ns가 유지된다.

### 5. 문서 마감

다음을 남긴다.

- 어떤 write 경로를 줄였는지
- 줄인 전/후 HTTP 호출 수
- 줄이지 않은 경로와 사유
- 성능 전/후 median
- `stdlibLoadOk` 포함 build summary
- 보류 카운트 `0/3 · 0/1`

## 완료 기준

1. `FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json`이 `ok:true`, `errors:0`, `stdlibLoadOk:true`다.
2. `scripts/perf-afldb.js --json`에서 `front_clips_crud_add_delete` median이 기준선보다 악화되지 않는다.
3. 실제 줄인 경로는 전/후 HTTP 호출 수가 문서에 있다.
4. 줄이지 않은 write 경로는 사유가 문서에 있다.
5. clips add/delete 실호출 후 잔여 데이터가 없다.
6. 후보 착수 0건이 보고에 명시된다.
7. `/gogs` 체크포인트 전까지 push하지 않는다.

## 보고 양식

- 착수 전 이해한 목적지 한 줄
- 기준선 표: HEAD, dirty, routes/helpers/codes, `stdlibLoadOk`, warnings
- write 경로별 호출 수 전/후
- 구현 파일과 선택 이유
- 줄이지 않은 경로와 사유
- 성능 전/후 median
- 검증 명령과 결과
- 후보 착수 0건 확인
- 보류 카운트 `0/3 · 0/1`
- 커밋 해시 전체
- 제외한 dirty 파일
- 남은 거리
