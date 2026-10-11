# Crew 지우 화면

경로: `/crew/jiwoo`

Argo의 `bigwash / 지우` 작업 화면을 참고한 FreeLang Front 내부 UI다.

## 화면 계약

- 기존 `layout-html` 앱 셸 안에 회사 내비게이션을 둔다.
- 본문은 세션 목록, 중앙 대화 타임라인, 에이전트·작업 컨텍스트 패널의 3열 구조다.
- 시운전 대화와 `pagination.py` 산출물 카드는 SSR로 즉시 표시한다.
- 하단 Composer는 `CrewComposer` Island로 동작하며 입력·보내기 상태를 클라이언트에서 관리한다.
- 실제 Argo 서버·파일 검색·에이전트 호출은 연결하지 않는다. 현재는 화면과 상호작용 골격만 구현한다.

## 검증

- `npm run build`: 150개 라우트 등록, 괄호·Island JS·미정의 함수·arity·트랩 검사 통과
- Island 테스트: 12/12 PASS
- 실제 HTTP: 이 검수 세션에서는 런타임이 40860을 이미 사용 중이라고 판정한 뒤 종료되어 `curl` 연결을 확인하지 못했다. 따라서 런타임 응답은 PASS로 주장하지 않는다.

다음 연결 작업은 Composer의 메시지 POST/SSE 계약과 작업 폴더·권한 API를 이 화면에 붙이는 것이다.
