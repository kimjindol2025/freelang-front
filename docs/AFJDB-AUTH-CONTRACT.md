# Front ↔ AFJ-DB 인증 계약

Front의 `_afldb.flx`는 AFJ-DB legacy KV 경로를 호환 유지하면서 인증과 주소를
환경변수로 받는다. 앱 코드가 키를 직접 포함하지 않는다.

## 환경변수

```bash
AFLDB_URL=http://127.0.0.1:40610
AFLDB_READ_KEY=read-key
AFLDB_WRITE_KEY=write-key
```

`AFLDB_ADMIN_KEY` 또는 legacy `AFLDB_API_KEY`는 read/write 키가 없을 때의
호환 fallback이다. 실제 운영에서는 역할별 키를 우선한다.

## 호출 규칙

- GET/status/history/verify: read key
- POST/PUT 성격의 KV 쓰기와 batch-put: write key
- DELETE: write key
- 키가 비어 있으면 로컬 인증 비활성 개발 환경을 위해 인증 헤더를 생략한다.
- AFJ-DB HTTP 4xx/5xx 또는 JSON `error`는 데이터·`ok=true`로 변환하지 않고
  실패로 처리한다.

## 검증 증거

인증 mock(`127.0.0.1:40619`)에서 read/write 키를 분리해 다음을 실제 실행했다.

```text
GET  /api/afldb                       PASS
POST /api/afldb action=get            PASS
POST /api/afldb action=put            PASS
```

실제 PM2 AFJ-DB와 Front에 `AFLDB_ADMIN_KEY`를 주입해
`PERF_N=3 PERF_WARM=1 node scripts/perf-afldb.js --json`을 실행했다.

```text
front_clips_api       median 31.2ms
afldb_stats           median 1.5ms
afldb_verify          median 25.4ms
clips CRUD 왕복       median 85.5ms
```

KV 인덱스 probe의 404는 없는 키를 뜻하므로 측정 실패로 중단하지 않고
라우팅·인증 지연만 기록한다. 실제 데이터 CRUD는 별도 add/delete probe로
잔여 데이터를 남기지 않게 검증한다.
