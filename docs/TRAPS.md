# FreeLang Front — Trap 카탈로그

빌드(`fl-front-build.js`)가 잡는 DX 함정. 코어 문법 변경이 아니라 **작성 후 탐지**.

## 활성 Trap

| code (대략) | 증상 | 올바른 패턴 |
|-------------|------|-------------|
| `json-parse-hyphen` | `(json-parse …)`가 서버에서 `s` 등 헬퍼와 충돌·오염 | `(json_parse …)` underscore만 |
| `upper-hyphen` | `FOO-BAR-BAZ`처럼 하이픈 **2개 이상** 대문자 심볼 → 뺄셈 파싱 | `foo_bar_baz` / `afl_db_base` |
| `let-shadow` | `let [s …]` / `h` / `h!`가 주입 헬퍼를 가림 | 다른 이름 (`sess`, `html`, …) |
| `fl-http-allow` | localhost/127.0.0.1 HTTP가 SSRF로 차단 | env `FL_HTTP_ALLOW=127.0.0.1,localhost` |

## 관련 규칙
- 상수: **소문자 + underscore** (`afl_db_base`). `AFL-DB-BASE` 금지.
- stdlib JSON: `json_parse` (kebab `json-parse` 금지 in front pages)
- style 헬퍼 `s`는 `FL_FRONT_HELPERS` — let 바인딩으로 가리지 말 것

## 의도적 미처리
- `APP-DB`처럼 하이픈 **1개**인 기존 상수는 upper-hyphen 경고에서 제외 (대량 rename 회귀 방지)
- 신규 코드에는 underscore 권장

## 진단 출력
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-build.js --json
# → schema: fl-diagnostics/1
```
