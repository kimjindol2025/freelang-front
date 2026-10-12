#!/usr/bin/env node
/**
 * Next90 내부 release gate.
 *
 * 정본 코드와 사용자 dirty 변경을 분리해서 확인한다.
 * - BASE_URL이 없으면 HTTP 항목은 BLOCKED로 남긴다.
 * - 이 스크립트는 stage/commit/push/deploy를 하지 않는다.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FX_RUNNER = process.env.FREELANG_AFJ_RUNNER || '/home/kim/kim/platform/freelang-v11-fx/bootstrap.js';
const BASE_URL = process.env.BASE_URL || process.env.FL_FRONT_BASE_URL || '';
const initialStatus = run('git', ['status', '--porcelain']);

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    exit: result.status === null ? 1 : result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

function lastJson(output) {
  const whole = output.trim();
  try { return JSON.parse(whole); } catch {}
  const lines = output.split(/\r?\n/).map(s => s.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}

function pass(name, detail) { return { name, status: 'PASS', detail }; }
function blocked(name, detail) { return { name, status: 'BLOCKED', detail }; }
function fail(name, detail) { return { name, status: 'FAIL', detail }; }

const checks = [];

// 전체 빌드는 한 번만 실행한다. 일반 출력으로 Island 회귀 결과까지 받고,
// builder가 저장한 .build-state.json을 같은 실행의 구조화 결과로 사용한다.
const build = run(process.execPath, ['fl-front-build.js']);
let buildJson = null;
try { buildJson = JSON.parse(fs.readFileSync(path.join(ROOT, '.build-state.json'), 'utf8')); } catch (_) {}
const islandPass = build.exit === 0
  && /Island 테스트 \d+\/\d+ PASS/.test(build.output)
  && /island 경계 이상 없음/.test(build.output);
if (build.exit === 0 && buildJson?.ok && buildJson.summary?.errors === 0 && islandPass) {
  checks.push(pass('build', `errors=${buildJson.summary.errors} warnings=${buildJson.summary.warnings} routes=${buildJson.routes.length}`));
} else {
  checks.push(fail('build', `exit=${build.exit}`));
}
checks.push(islandPass
  ? pass('island-regression', 'included in the single build run')
  : fail('island-regression', 'build-integrated test missing or failed'));

const manifest = run(process.execPath, ['fl-manifest.js', '--json']);
const manifestJson = lastJson(manifest.output);
checks.push(buildJson?.ok && manifest.exit === 0 && manifestJson?.schema === 'fl-manifest/1'
  ? pass('ai-contract', `errors=${buildJson.summary.errors} manifest=${manifestJson.schema}`)
  : fail('ai-contract', `build=${build.exit} manifest=${manifest.exit}`));

const languageConformance = run(process.execPath, ['scripts/front-language-conformance.js']);
const languageConformanceJson = lastJson(languageConformance.output);
checks.push(languageConformance.exit === 0 && languageConformanceJson?.pass === true
  ? pass('language-conformance', `source_files=${languageConformanceJson.source_files}`)
  : fail('language-conformance', `exit=${languageConformance.exit}`));

const languageScript = run(process.execPath, [
  '/home/kim/freelang-script/bin/fl-script-unified.js',
  'run',
  '--allow-read=.,/home/kim/freelang-script',
  'scripts/front-language-contract.fls',
  'front-language.contract.json',
]);
checks.push(languageScript.exit === 0 && /LANGUAGE_CONTRACT_FLS=PASS/.test(languageScript.output)
  ? pass('language-script', 'FreeLangScript contract entrypoint')
  : fail('language-script', `exit=${languageScript.exit}`));

const languageDiagnostics = run(process.execPath, ['scripts/front-diagnostics-contract.js']);
const languageDiagnosticsJson = lastJson(languageDiagnostics.output);
checks.push(languageDiagnostics.exit === 0 && languageDiagnosticsJson?.pass === true
  ? pass('language-diagnostics', `schema=${languageDiagnosticsJson.build_schema} code=${languageDiagnosticsJson.diagnostic?.code}`)
  : fail('language-diagnostics', `exit=${languageDiagnostics.exit}`));

const collectionAdapter = run(process.execPath, ['scripts/front-collection-adapter-contract.js']);
const collectionAdapterJson = lastJson(collectionAdapter.output);
checks.push(collectionAdapter.exit === 0 && collectionAdapterJson?.pass === true
  ? pass('collection-adapter', `profile=${collectionAdapterJson.profile} operations=${collectionAdapterJson.operations.join(',')}`)
  : fail('collection-adapter', `exit=${collectionAdapter.exit}`));

const multiInstance = run(process.execPath, ['scripts/multi-instance-contract.js']);
const multiInstanceJson = lastJson(multiInstance.output);
checks.push(multiInstance.exit === 0 && multiInstanceJson?.pass === true
  ? pass('multi-instance', `ports=${multiInstanceJson.ports.join(',')}`)
  : fail('multi-instance', `exit=${multiInstance.exit}`));

const performanceContract = run(process.execPath, ['scripts/performance-contract.js']);
const performanceJson = lastJson(performanceContract.output);
checks.push(performanceContract.exit === 0 && performanceJson?.pass === true
  ? pass('performance-contract', `rss_kb=${performanceJson.process_rss_kb} api_p95=${performanceJson.routes['/api/hello'].p95}ms`)
  : fail('performance-contract', `exit=${performanceContract.exit}`));

const hmrContract = run(process.execPath, ['scripts/hmr-contract.js']);
const hmrJson = lastJson(hmrContract.output);
checks.push(hmrContract.exit === 0 && hmrJson?.pass === true
  ? pass('hmr-contract', `events=${hmrJson.events.join(',')}`)
  : fail('hmr-contract', `exit=${hmrContract.exit}`));

const browserErrorMap = run(process.execPath, ['scripts/browser-error-map-contract.js']);
const browserErrorMapJson = lastJson(browserErrorMap.output);
checks.push(browserErrorMap.exit === 0 && browserErrorMapJson?.pass === true
  ? pass('browser-error-map', 'generated _app.fl location resolves to original .flx')
  : fail('browser-error-map', `exit=${browserErrorMap.exit}`));

const sourceContext = run(process.execPath, ['scripts/front-source-context.js', '--file', 'pages/index.flx', '--line', '1']);
const sourceContextJson = lastJson(sourceContext.output);
checks.push(sourceContext.exit === 0 && sourceContextJson?.schema === 'fl-front-source-context/1' && sourceContextJson?.ok === true
  ? pass('front-source-context', `source=${sourceContextJson.source.file}:${sourceContextJson.source.line}`)
  : fail('front-source-context', `exit=${sourceContext.exit}`));

const scaffold = run(process.execPath, ['scripts/scaffold-contract.js']);
const scaffoldJson = lastJson(scaffold.output);
checks.push(scaffold.exit === 0 && scaffoldJson?.pass === true
  ? pass('scaffold-contract', 'dry plan + input boundaries')
  : fail('scaffold-contract', `exit=${scaffold.exit}`));

const ui = run(process.execPath, ['scripts/ui-contract-gate.js']);
const uiJson = lastJson(ui.output);
checks.push(ui.exit === 0 && uiJson?.pass === true
  ? pass('ui-contract', `violations=${uiJson.violations?.length ?? 0}`)
  : fail('ui-contract', `exit=${ui.exit}`));

const typecheck = run(process.execPath, ['scripts/front-typecheck.js', '--json'], {
  FREELANG_AFJ_RUNNER: FX_RUNNER,
});
let typecheckJson = null;
try { typecheckJson = JSON.parse(typecheck.output.trim()); } catch (_) {}
const typecheckPass = typecheck.exit === 0 && typecheckJson?.pass === true;
checks.push(typecheckPass
  ? pass('typecheck', 'source + generated _app.fl via official FX runner')
  : fail('typecheck', `exit=${typecheck.exit}`));

const stateContract = run(process.execPath, ['scripts/state-contract-gate.js', '--json']);
const stateJson = lastJson(stateContract.output);
checks.push(stateContract.exit === 0 && stateJson?.pass === true
  ? pass('state-contract', 'targeted atom/store fixture')
  : fail('state-contract', `exit=${stateContract.exit}`));

for (const script of ['test-fl-loop-humanshare.js', 'test-fl-comment-defn-narrow.js', 'test-fl-req-key-collision.js']) {
  const result = run(process.execPath, [script]);
  checks.push(result.exit === 0 ? pass(script, 'regression') : fail(script, `exit=${result.exit}`));
}

// build가 갱신하는 generated state는 검증 산출물이다. 사용자 변경 보호 판정은
// build 이전 상태를 기준으로 해야 clean artifact가 자기 자신을 dirty로 만들지 않는다.
const cleanDeploy = initialStatus.output.trim() === '';
checks.push(cleanDeploy
  ? pass('clean-worktree', 'clean')
  : blocked('clean-worktree', 'existing user changes preserved'));

if (BASE_URL) {
  const app = run(process.execPath, ['tests/next90-app-matrix.js'], { BASE_URL });
  checks.push(app.exit === 0 ? pass('next90-app', BASE_URL) : fail('next90-app', `exit=${app.exit}`));
  const smoke = run('bash', ['.freelang/smoke.sh'], { FL_FRONT_BASE_URL: BASE_URL });
  checks.push(smoke.exit === 0 ? pass('internal-smoke', BASE_URL) : fail('internal-smoke', `exit=${smoke.exit}`));
  const sse = run(process.execPath, ['scripts/sse-contract-gate.js'], { BASE_URL });
  checks.push(sse.exit === 0 ? pass('sse-contract', 'metrics + alerts real HTTP stream') : fail('sse-contract', `exit=${sse.exit}`));
  const spa = run(process.execPath, ['scripts/spa-contract-gate.js'], { BASE_URL });
  checks.push(spa.exit === 0 ? pass('spa-contract', 'CSP-safe SSR/Island bridge over real HTTP') : fail('spa-contract', `exit=${spa.exit}`));
} else {
  checks.push(blocked('next90-app', 'BASE_URL is required for real HTTP verification'));
  checks.push(blocked('internal-smoke', 'BASE_URL is required for real HTTP verification'));
  checks.push(blocked('sse-contract', 'BASE_URL is required for real HTTP verification'));
  checks.push(blocked('spa-contract', 'BASE_URL is required for real HTTP verification'));
}

const failures = checks.filter(x => x.status === 'FAIL');
const blockedChecks = checks.filter(x => x.status === 'BLOCKED');
const result = {
  schema: 'fl-next90-gate/1',
  repo: path.basename(ROOT),
  head: run('git', ['rev-parse', '--short', 'HEAD']).output.trim(),
  pass: failures.length === 0 && blockedChecks.length === 0,
  checks,
  known_limitations: ['dashboard keeps polling fallback when EventSource is unavailable'],
};

console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 2);
