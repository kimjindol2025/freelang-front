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

실제 AFJ-DB 성능 수치는 별도 `AFLDB_ADMIN_KEY`가 제공될 때
`scripts/perf-afldb.js`로 측정한다.
