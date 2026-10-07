# Decision AI API

`POST /api/decision`은 여러 프로젝트가 공통으로 사용할 수 있는 판단 어댑터다. 각 프로젝트는 질문, 선택지, 맥락만 전달하고, provider 인증과 구조화된 결과 처리는 서버 모듈이 담당한다.

## Request

```json
{
  "question": "이번 주에 어떤 작업을 먼저 할까?",
  "options": [
    {"id": "bug", "label": "긴급 버그 수정"},
    {"id": "feature", "label": "신규 기능 구현"}
  ],
  "context": {"deadline": "내일", "team_size": 1},
  "constraints": ["사용자 영향이 큰 항목 우선"]
}
```

`DECISION_API_KEY`가 설정된 서버에서는 `Authorization: Bearer <DECISION_API_KEY>`가 필요하다. OpenAI 키는 `OPENAI_API_KEY`로만 설정하며 요청 클라이언트에 노출하지 않는다.

## Response

```json
{
  "ok": true,
  "decision": {
    "option_id": "bug",
    "recommendation": "긴급 버그 수정",
    "confidence": 0.88,
    "reasoning": "사용자 영향과 마감일을 함께 고려하면 ...",
    "risks": ["신규 기능 일정이 늦어질 수 있음"],
    "next_action": "버그 재현 절차를 먼저 확인"
  },
  "provider": {
    "id": "resp_...",
    "model": "gpt-5",
    "client_request_id": "...",
    "status": "completed"
  }
}
```

`client_request_id`는 OpenAI의 `X-Client-Request-Id`로 전달되는 내부 추적 ID다. 현재 FreeLang HTTP 응답 계약은 응답 헤더를 노출하지 않으므로 provider가 생성한 `x-request-id`는 아직 반환하지 않는다.

## Runtime configuration

```bash
export OPENAI_API_KEY='...'
export OPENAI_MODEL='gpt-5'
export DECISION_API_KEY='internal-project-token'
```

테스트나 사내 프록시에서는 `OPENAI_BASE_URL`을 Responses API 호환 mock/proxy 주소로 지정할 수 있다.

The module is `stdlib/decision-ai.flx`; other FreeLang Front projects can copy the module into their shared stdlib path and load it from an API route.
