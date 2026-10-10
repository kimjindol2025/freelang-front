# FreeLang Front 언어 독립성 계약

FreeLang Front는 특정 상용 프레임워크의 플러그인이 아니라 FreeLang 기반의
독립적인 프론트 언어다. 정본은 `.flx` 소스이며, v11/AFJ·FX·AFJ-DB95·브라우저·
FreeLangScript는 명시된 어댑터 경계로 연결한다.

## 현재 기준

현재 저장소에는 JS 파일 33개, raw `<script>`를 포함한 `.flx` 파일 2개,
관련 검색 line 73건, Island 선언 65건이 있다. 이 수치에는 `_layout.flx`의
오류·HMR·성능 수집용 브라우저 bridge도 포함된다. 제품 기능 쪽에서는
`logs.flx`의 폴링을 `every!`로, `followups`의 날짜 보조 함수를
`date-add-days`로 흡수했다. 업로드·에러 초기화·플래시 학습 화면도 각각 서버
폼과 HTML `details`로 흡수해 기능 페이지의 inline JavaScript를 제거했다.
클립보드 접근은 `copy!` primitive와 브라우저 bridge 계약으로 흡수했다.
이 수치는 제거 목표가 아니라 앞으로 생성 코드·
런타임·도구를 어느 층으로 흡수할지 추적하는 기준선이다.

기계가 읽는 계약은 [`front-language.contract.json`](../front-language.contract.json)이며,
`npm run language:check`가 계약을 검증한다.
FreeLangScript 진입점인 `npm run language:check:fls`도 같은 계약을 읽는다.
`npm run language:conformance`는 실제 `.flx` 소스의 SSR·API·Island·상태·라우팅과
headless 상태 실행을 검증한다. raw `<script>`가 남은 파일도 계약의
`browser_boundaries` 목록과 정확히 일치해야 하므로, 새 JS 결합은 목록에 등록하지
않으면 conformance에서 실패한다.

서버 호출도 `adapter_contract.tokens`로 고정한다. 현재 `server-*`·`db-*`는
v11-AFJ, `afldb-*`와 `http_request`는 AFJ-DB95, `http-get`·`shell`은 FX,
`copy!`·`fetch!`·`every!`·`prop` 등은 브라우저 bridge로 분류된다. 실제 `.flx`
호출 844건을 `npm run language:conformance`가 이 목록과 대조한다.
이 검사는 교체 가능한
경계의 존재를 보장하지만, 다른 런타임으로의 실제 교체까지 완료했다는 뜻은 아니다.

첫 번째 언어 표면 수직 슬라이스로 `front-db-query`·`front-db-exec`를 추가했다.
인증·OAuth·노트 페이지/API는 이 이름만 사용하고, 실제 `db-query`·`db-exec`는
`pages/**/_db.flx` 구현 경계에만 남는다. 동적 노트 mutation도 `render_post`와
POST 등록을 conformance로 확인한다. 따라서 이 슬라이스는 이후 SQLite provider를
바꾸더라도 `.flx` 기능 코드를 건드리지 않을 수 있는 최소 교체 단위다.

두 번째 슬라이스로 `front-http-get`을 추가했다. 운영 대시보드와 shop SSR은
이 표면만 호출하고, FX `http-get`은 `pages/_http.flx`에 격리한다. AFJ-DB의
`http_request`도 `pages/_afldb.flx` 경계로 고정해 HTTP 호출에도 소스와 구현의
경계를 둔다.

세 번째 슬라이스로 `front-collection-*`을 추가했다. bookmarks·scratch·notes-afldb·
todo-afldb·clips·events는 이 표면만 호출하고, `afldb-coll-*`는
`pages/_afldb_coll.flx`에 격리한다. 실제 AFJ-DB route는 인증이 없을 때도
`E_UNAUTHORIZED`를 숨기지 않고 반환하는 것까지 임시 서버에서 확인했다.
추가로 `npm run adapter:collection`은 같은 `.flx` routes를
`FL_FRONT_COLLECTION_ADAPTER=memory`로 실행해 list/create/update/history/delete를
통과시킨다.
이는 AFJ-DB95의 production 성공을 대신하지 않고, Front 언어 표면과 두 번째
provider 구현이 실제로 분리되어 있음을 검증한다.

공통 브리지는 `browser_bridge.modules`로 기능별 책임을 고정한다. 현재 모듈은
`theme`, `hmr`, `devtools`, `error-overlay`, `error-collector`, `performance`,
`spa`이며, 빌드와 conformance가 `_layout.flx` 안의 실제 `define` 존재까지 확인한다.

### 남은 브라우저 경계 분류

| 분류 | 현재 위치 | 처리 방향 |
|---|---|---|
| 공통 bridge | `pages/_layout.flx` | `theme`·`hmr`·`devtools`·`error-overlay`·`error-collector`·`performance`·`spa` 모듈 계약으로 분리·검증 |
| 레거시 대시보드 | 없음 | 현재 등록된 대시보드 raw JS 경계 없음 |
| 외부/실험 영역 | `pages/fx2-wasm/index.html.flx` | 기능 계약을 먼저 정한 뒤 독립성 gate에 편입 |
| 흡수 완료 | `pages/logs.flx`, `pages/followups/index.flx`, `pages/notes.flx`, `pages/dashboard/{alerts,index,operations,sla,custom-metrics}.flx`, `pages/shop/products/[id].flx`, `pages/upload.flx`, `pages/api/errors-stats.flx`, `pages/flash/study.flx` | `every!`, `date-add-days`, 서버 폼, SSR, Island props, native `details`로 페이지 기능의 raw JS 제거 |

## 독립성 원칙

1. 기능은 먼저 `.flx`로 작성한다.
2. SSR·API·상태·라우팅의 의미는 FreeLang Front 계약이 정한다.
3. 브라우저 JS는 생성된 실행 경계로만 허용한다.
4. DB·FX·AFJ는 교체 가능한 서버 어댑터로 취급한다.
5. 빌드·검수·릴리즈 자동화는 FreeLangScript로 흡수한다.
6. Next.js는 기능 비교 기준일 뿐 소스·런타임 의존성이 아니다.

## 10단계 발전 순서

| 단계 | 목표 | 통과 기준 |
|---:|---|---|
| 1 | 언어·어댑터 계약 고정 | `fl-front-language/1` 검증 PASS |
| 2 | FreeLang Front 문법·진단 정리 | `syntax` 진단이 파일·라인·힌트와 함께 재현 |
| 3 | SSR 표준화 | 페이지·layout·SEO가 `.flx`만으로 동작 |
| 4 | API 표준화 | JSON·검증·오류·인증 계약이 `.flx`로 고정 |
| 5 | 라우팅 흡수 | 파일 라우터 의미가 Front 계약으로 문서화·검증 |
| 6 | 상태·Island 의미론 | atom·event·fetch·재렌더가 언어 테스트로 검증 |
| 7 | 브라우저 브리지 축소 | JS는 생성 bridge/runtime 경계로만 남음 |
| 8 | v11/AFJ·FX·AFJ-DB95 어댑터 | 서버·DB 교체가 `.flx` 소스 변경 없이 가능 |
| 9 | FreeLangScript 도구화 | build/check/review/test/release를 `.fls` 계약으로 실행 |
| 10 | 독립 릴리즈 | clean clone에서 재현 빌드·smoke·rollback PASS |

현재 언어 계약 버전은 `fl-front-language/1`이며, 페이지 기능 흡수, 브라우저
bridge 모듈 계약, 구조화 `syntax` 진단, 어댑터 호출 인벤토리, FreeLangScript
검수, 임시 clean clone dry-run과 실제 HTTP smoke까지 실제 게이트로 확인했다.
다음 구현 순서는 어댑터 호환 구현을 하나씩 붙여 교체 검증하는 일이며, 그 뒤에
원본 변경사항을 검증된 commit으로 반영한다.
