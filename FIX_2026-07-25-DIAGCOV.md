# FIX — freelang-front DIAGCOV-001 (2026-07-25)

## 증상
- 스캐폴드 BLOCKED_FIELDS로만 `text`↔body 충돌을 막아, 손코드는 사각.
- humanShare에 교육용 주석(`; … (defn render …)`)이 comment-defn 2건으로 섞임.

## 원인
- 예약 키 검출이 도구 레이어(스캐폴드)에만 있음.
- comment-defn이 주석 안 어디든 `(defn` 부분문자열을 잡음.

## 수정 (파일·변경 요약)
- `fl-front-build.js` — Trap `req-key-collision` (#11); `comment-defn`을 `; (defn|define|server-fn` 비활성 코드형만으로 축소
- `fl-diagnostic-codes.js` — 코드 18→19 (`req-key-collision`, machine-applicable)
- `fl-front-fix.js` — `text`→`content` 치환 (`:type "text"`·`action`/`id` 비대상)
- `fl-manifest.js` traps · `docs/TRAPS.md`
- 테스트(커밋, 픽스처 런타임만): `test-fl-req-key-collision.js`, `test-fl-comment-defn-narrow.js`

## 검증
```bash
FL_HTTP_ALLOW=127.0.0.1,localhost node test-fl-req-key-collision.js
# PASS detect=3 fix=3 falsePositive=0 rebuildOk

FL_HTTP_ALLOW=127.0.0.1,localhost node test-fl-comment-defn-narrow.js
# PASS dead code=1 mid-sentence examples=0

FL_HTTP_ALLOW=127.0.0.1,localhost node fl-front-loop.js --dry
# humanShare 26 · codes 19 · converged true · 126r/13h

node fl-scaffold.js --ns diagcovtmp --fields content --dry
# schema fl-scaffold/1 dry true
```

## PM2
해당 없음 (빌드/진단 도구 레이어). 서비스 재시작 불필요.
