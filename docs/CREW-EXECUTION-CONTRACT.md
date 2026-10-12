# Crew 실행 계약 v1

`/crew/chat`은 Argo의 실행 흐름을 FreeLang Front 안에서 단계적으로 흡수하기 위한
첫 번째 서버 계약이다. 현재 runner는 `openai-responses` 하나이며, 실제 도구 실행이나
MCP 연결을 이미 지원한다고 가장하지 않는다.

## 요청

```json
{
  "message": "사용자 요청",
  "history": [],
  "session_id": "crew-default"
}
```

`session_id`가 없으면 `crew-default`를 사용한다. 서버는 매 호출마다 `trace_id`를 만든다.

## 응답 공통 필드

```json
{
  "runtime": {
    "runner": "openai-responses",
    "model": "gpt-5",
    "session_id": "crew-default",
    "trace_id": "..."
  },
  "evidence": {
    "kind": "provider-call",
    "request": "sent|not-sent",
    "provider_status": "ok|not-configured|...",
    "trace_id": "...",
    "tool_calls": []
  }
}
```

성공은 `ok: true`, `message`를 포함한다. 인증키 없음·빈 입력·provider 오류도 같은
계약으로 반환하여 UI가 근거와 함께 표시할 수 있다. Island의 `fetch-post!`가 비-2xx
응답 callback을 실행하지 않는 현재 런타임 제약 때문에 HTTP 상태는 200으로 유지하고,
실제 실패 상태는 JSON의 `ok`·`status`·`evidence`에 담는다.

## 저장 경계

`/crew/api`의 assistant 메시지는 `body`와 함께 `runtime`, `evidence`를 SQLite
`data/crew.db`에 저장한다. 다음 단계에서 이 계약 위에 runner catalog, 권한 gate,
도구 호출, 세션 재개를 붙인다.

## 현재 경계

- runner: OpenAI Responses API만 연결
- 도구/MCP: 호출하지 않음
- 파일·쉘 권한: 부여하지 않음
- streaming: 미구현
- 실제 API 키가 없으면 provider 호출은 실행하지 않고 `not-configured`로 기록
