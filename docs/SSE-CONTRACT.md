# FreeLang Front SSE 계약

FreeLang Front의 metrics/alerts는 FX 런타임의 `server-sse` 스트림을 사용한다.
페이지 파일이 로드될 때 라우트를 부작용으로 등록하지 않고, `server.fl`이
`_app.fl`보다 먼저 다음 두 라우트를 등록한다.

- `GET /api/metrics/stream`
- `GET /api/alerts/stream`

연결 직후 `data: {"type":"ready", ...}`를 한 번 보내고, 이후 메트릭 기록이나
임계값 초과 알림이 발생하면 generic SSE `message`로 JSON payload를 보낸다.
브라우저가 EventSource를 지원하지 않거나 연결이 실패하면 Dashboard의 기존
폴링 fallback을 사용한다.

## 실제 검수

```bash
BASE_URL=http://127.0.0.1:40860 node scripts/sse-contract-gate.js
```

이 검수는 실제 스트림을 열고 `POST /api/metrics`를 발생시켜 metrics 이벤트와
alerts 이벤트가 각각 도착하는지 확인한다. 문법 검사나 200 응답만으로는 PASS로
판정하지 않는다.

로컬 PM2가 사용하는 `runtime/bootstrap.js`는 FreeLang v11 정본 런타임에서
생성한 번들이어야 하며, `server-sse`와 `sse_send` 계약이 없는 오래된 번들은
기동 단계에서 차단한다.
