# F-3 스타일 변환기 FreeLang 전환 기록

## 1. 해시 클래스 규칙과 기준 목록

JS 기준의 원문 계산식:

```js
const key  = JSON.stringify({ base, pseudo, responsive });
const hash = hashStr(name + key);
const cls  = name.replace(/-/g, '_') + '__' + hash;
let h = 5381;
for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
return (h >>> 0).toString(16).slice(0, 4);
```

속성 쌍은 따옴표 값부터 소스 순서대로, 그다음 숫자 값을 넣는다. 해시는 CSS 선언이 아닌 이 배열과 의사 상태·화면 크기 맵의 JSON, 그리고 스타일 이름으로 결정된다. JS 문자열의 UTF-16 코드 단위와 32비트 부호 없는 결과를 FreeLang에서도 따른다.

기준은 `9c1202dae761f1faff777c48887ed19f5960b3c9`에 먼저 커밋했다. `tests/style-golden/app.css` 1개, 모든 `pages/**/*.flx`의 페이지별 CSS 135개, 같은 이름의 `pages/freelang.css` 정규화 결과 1개, 합계 137개다. `pages/_styles.flx`의 결과는 0바이트인 `tests/style-golden/pages/_styles.css`로 포함했다. 캡처 절차는 실행 전에 `c34736930fafb060e89301530747de2b4d92d84b`, 공백 정규화 수정은 실행 전에 `d9142c1ad1ca55904dbdf7b8e190d93e95e7429f`로 커밋했다. 기준 파일은 이후 수정하지 않았다.

```
dcd2bb1ca7ec6ba712a24d007984763a4d41f0b24a703a937ab88ce753a6058b  tests/style-golden/app.css
```

## 2. 새 변환기 구조

- `style-compiler.fl:2`: JS의 모든 등록 속성 및 그림자·화면 크기 표.
- `style-compiler.fl:54`, `style-compiler.fl:88`: 선언 쌍 파싱과 기본·의사 상태·화면 크기 분류.
- `style-compiler.fl:114`, `style-compiler.fl:131`: UTF-8 입력을 JS의 UTF-16 코드 단위로 해시하고 클래스 이름 생성.
- `style-compiler.fl:137`, `style-compiler.fl:173`: CSS 선언·규칙 생성과 미등록 속성 경고.
- `style-compiler.fl:194`, `style-compiler.fl:227`, `style-compiler.fl:230`: 중첩 페이지 탐색, 페이지별 CSS, 같은 이름의 CSS 정규화·병합.
- `style-compiler.fl:274`: `styled.flx`의 정적 문자열과 클래스 바인딩으로 CSS가 포함된 HTML 생성.
- `scripts/build-style-fl.sh:1`: x86 네이티브 cgc와 C 런타임으로 변환기 실행.

기존 `style-compiler.js`와 `package.json`의 전체 프론트 빌드는 비교 기준으로 보존했다. 네이티브 실행 경로가 `public/app.css`를 생성한다.

## 3. 비교 결과: cmp 원문

```
$ sh tests/style-golden/compare.sh
STYLE_CMP_FILES=137
STYLE_CMP_EXIT=0
```

`cmp` 자체의 표준 출력은 137회 모두 비어 있었고 종료 코드가 0이었다. 차이 목록: 0건. 임시 입력의 `sm/md/lg/xl` 규칙, `hover` 및 한글·이모지 해시도 각각 JS 결과와 `cmp` 종료 코드 0이었다. 임시 입력은 기준에 추가하지 않았다.

## 4. Node 없는 실행과 strace

```
NATIVE_EXIT=0
CMP_EXIT=0
STYLE_CMP_FILES=137
STYLE_CMP_EXIT=0
NODE_NPM_NPX_JS_PYTHON_EXECVE=0
WARNING_COUNT=77
STYLE_FL_STYLES=143
```

`strace -f -e execve`의 네이티브 실행 원문 발췌:

```
819369 execve("../../../../work/fl-8/freelang-v11/bin/cgc-bin-x86_64-seed-v11", ["../../../../work/fl-8/freelang-v"..., "style-compiler.fl", "/tmp/tmp.dIwWipF1Aq/style-compil"...], 0x55d83176d330 /* 109 vars */) = 0
819456 execve("/tmp/tmp.dIwWipF1Aq/style-compiler", ["/tmp/tmp.dIwWipF1Aq/style-compil"...], 0x55d83176d330 /* 109 vars */) = 0
```

실행 파일 이름 전체는 `as,cc1,cgc-bin-x86_64-seed-v11,collect2,dirname,find,gcc,ld,mkdir,mktemp,rm,sh,style-compiler`였다. 생성된 `public/styled.html`에는 `<style>`, 해시 클래스와 화면 크기별 CSS가 있다.

```
87d4754ecffa9abf208ee9c929542b7832df29689311703eda5278aeb2bc7c3f  public/styled.html
```

## 5. STYLE_FL_SUMMARY

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| a 기준 파일 커밋 | PASS | `9c1202d` |
| b 모든 입력 바이트 일치 | PASS | `STYLE_CMP_FILES=137`, `STYLE_CMP_EXIT=0` |
| c 화면 크기별 규칙 일치 | PASS | 임시 4단계 입력 JS·FreeLang `cmp` 0 |
| d 미등록 속성 경고 | PASS | 실제 입력 경고 77건, 임시 `:unknown` 경고 |
| e Node 0회로 app.css 생성 | PASS | `NODE_NPM_NPX_JS_PYTHON_EXECVE=0` |
| f styled.flx HTML에 CSS 포함 | PASS | `public/styled.html`의 `<style>`와 클래스 |
| g 기존 프론트 시험 통과 | PASS | 양쪽 JS 빌드 종료 0, Island 테스트 각각 11/11 |
| h 기존 JS 빌드 결과 동일 | PASS¹ | app.css 원문 `cmp` 0, 생성 시각 한 줄 제거한 `_app.fl` `cmp` 0 |

`STYLE_FL_SUMMARY=8/8` (¹생성 시각 제외). `_app.fl` 원문 `cmp`는 1이다. 원문 출력:

```
/tmp/f3-js-before/_app.fl _app.fl differ: byte 80, line 2
RAW_APP_FL_CMP_EXIT=1
APP_CSS_CMP_EXIT=0
APP_FL_NORMALIZED_CMP_EXIT=0
```

차이 이유는 기존 JS 빌드가 2행에 현재 생성 시각을 쓰기 때문이다. 코드 본문과 CSS는 같다.

## 6. v11에 없는 기능 목록

이번 CSS 변환에 필요한 파일 읽기·쓰기, 디렉터리 탐색, 문자 코드, 비트 연산, JSON 문자열화는 x86 네이티브 cgc 빌드에서 사용 가능했다. 없는 기능: 없음. 제공된 `bin/fl`은 이 환경의 CPU 형식과 달라 실행할 수 없어 x86 cgc 도구를 썼다. v11 소스나 가지는 수정하지 않았다.

## 7. 커밋·원격 HEAD와 미확인 항목

작업 가지는 `feat/research-notes`의 확인된 `d4f65837e413a67a43aaa99a583472ae92bfb63e`에서 갈라졌다. 지정 시작 커밋 `a53e0ff`는 이 사본의 Git 객체에 없어 검증할 수 없었다. 구현 커밋은 `701a5bb0ec8a5a204566acba771c21a4fb8c3fe7`이다. 이 문서를 포함한 최종 커밋과 두 원격 HEAD의 `git ls-remote` 원문은 푸시 후 최종 응답에 기록한다. 문서 자체에 최종 커밋 ID를 넣으면 그 ID가 다시 바뀐다.

미확인: `styled.html`은 이 페이지의 정적 문자열과 클래스 바인딩을 처리하며, 전체 `layout-html` SSR 출력과의 바이트 비교는 하지 않았다. 전체 프론트 빌드는 여전히 JS 경로다.

커밋 전 작업 가지 전체 diff와 staged diff의 민감 문자열 검사 원문:

```
SENSITIVE_DIFF_MATCHES=0
SECRET_TERMS=0
```
