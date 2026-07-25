# FIX — freelang-front Error Overlay (2026-07-25)

## 증상
- 런타임/Island 오류가 콘솔·`/api/errors`에만 쌓이고, Next.js처럼 **페이지 안**에서 바로 안 보임
- 429/HMR 연결 거부 같은 노이즈가 에러 수집을 잠식

## 원인
- `ERROR-COLLECTOR`는 원격 전송만 하고 UI 오버레이가 없었음
- Island `_err`도 콘솔 출력만 수행

## 수정 (파일·변경 요약)
| 파일 | 변경 |
|------|------|
| `pages/_layout.flx` | `ERROR-OVERLAY` (`window.__FL_EO`) — localhost 전용 모달·배지·Esc/Ctrl+Shift+E |
| `pages/_layout.flx` | `ERROR-COLLECTOR` → `__FL_EO.report` + 노이즈 필터 + localhost API 스로틀 |
| `island-compiler.js` | `_err` → `__FL_EO.report` |
| `pages/dev/error-demo.flx` | 수동 테스트 페이지 `/dev/error-demo` |

## 검증
```bash
curl -s http://localhost:40860/dev/error-demo | grep -c __FL_EO
# ≥ 1

# 브라우저
# http://localhost:40860/dev/error-demo
# → "오버레이 띄우기" 클릭
# → Esc 닫기 후 좌하단 빨간 배지 · Ctrl+Shift+E
```

콘솔에서도:
```js
__FL_EO.report({type:'test',message:'hello',source:'console',stack:'at foo (pages/x.flx:1:1)'})
```

## PM2
```bash
node fl-front-build.js
pm2 restart freelang-front --update-env
```
