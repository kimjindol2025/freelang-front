# FreeLang Front 내부 배포 계약

이 계약은 외부 공개 배포가 아니라 이 서버의 코딩용 내부 Front를 검증하는
경계다. 공용 포트, SSH, 외부 release, PM2 이름 추측은 범위에 포함하지 않는다.

## 고정 경계

- 정본: `/home/kim/kim/platform/freelang-front`
- 실행: 프로젝트가 정의한 `npm start`와 `FL_HTTP_ALLOW=127.0.0.1,localhost`
- 기본 포트: `40860`
- 내부 rate limit: `1000 requests / 60s` — 브라우저 HMR·metrics와 smoke가
  loopback bucket을 공유하므로 내부 검수용으로 명시한다. 외부 공개 계약에는
  이 값을 재사용하지 않는다.
- 검수: `.freelang/smoke.sh`
- 배포 전 검사: `.freelang/deploy.sh check`
- 복구 계획: `.freelang/rollback.sh <verified-commit>`
- DB: 프로젝트의 런타임 `.db`; Git에 추가하지 않는다.

## 순서

```text
clean worktree 확인
→ node fl-front-build.js --json
→ 내부 서버 기동
→ .freelang/smoke.sh
→ artifact/commit 확인
→ operator가 내부 반영
→ 같은 smoke 재실행
```

`deploy.sh`는 dirty worktree에서 차단한다. 현재 사용자 작업이 남아 있으면
그 상태는 실패가 아니라 `DEPLOY_BLOCKED=dirty-worktree`이며, 자동 stage·commit·
삭제를 하지 않는다. `rollback.sh`도 검증된 커밋과 `FL_ROLLBACK_APPLY=1`을
둘 다 요구한다.

## 현재 판정

- 계약 파일: 구현됨
- 실제 clean deploy: `BLOCKED` — 기존 사용자 dirty 변경이 존재함
- 실제 smoke: `PASS` — 5개 대표 화면 200 + 정본 `/api/hello` JSON contract 200
- 사용자 dirty 기능(예: `/api/decision`)은 별도 feature smoke/e2e로 검증하며 clean artifact gate의 의존성으로 사용하지 않는다.
- 외부 공개 배포: 범위 밖
