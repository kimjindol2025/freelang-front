#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'pages');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'front-language.contract.json'), 'utf8'));

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

const flxFiles = files(PAGES).filter((file) => file.endsWith('.flx'));
const text = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const generated = fs.existsSync(path.join(ROOT, '_app.fl')) ? text('_app.fl') : '';
const rawScriptFiles = flxFiles
  .filter((file) => /<script[\s>]/i.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(ROOT, file).replaceAll(path.sep, '/'))
  .sort();
const all = flxFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const checks = [];
function check(name, pass, detail) { checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail }); }

const adapterIds = new Set((contract.adapters || []).map((adapter) => adapter.id));
const adapterRules = (contract.adapter_contract?.tokens || []).flatMap((entry) => entry.patterns.map((pattern) => ({
  adapter: entry.adapter,
  pattern,
  regex: new RegExp(pattern),
})));
const adapterInventory = [];
const adapterTokenPattern = /\(([A-Za-z][A-Za-z0-9_!?-]*)(?![A-Za-z0-9_!?-])/g;
for (const file of [...flxFiles, path.join(ROOT, 'server.fl')].filter((candidate) => fs.existsSync(candidate))) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
  for (const match of source.matchAll(adapterTokenPattern)) {
    const token = match[1];
    const rule = adapterRules.find((candidate) => candidate.regex.test(token));
    if (rule) adapterInventory.push({ file: relative, token, adapter: rule.adapter });
  }
}
const invalidAdapterRules = adapterRules.filter((rule) => !adapterIds.has(rule.adapter));
const adapterCounts = adapterInventory.reduce((counts, item) => {
  counts[item.adapter] = (counts[item.adapter] || 0) + 1;
  return counts;
}, {});
check('adapter-contract', invalidAdapterRules.length === 0 && adapterInventory.length > 0,
  `calls=${adapterInventory.length} adapters=${Object.entries(adapterCounts).map(([id, count]) => `${id}:${count}`).join(',') || 'none'}`);
const rawBoundaryRules = contract.adapter_contract?.raw_runtime_boundaries || [];
const rawBoundaryViolations = adapterInventory.filter((item) => {
  const rule = rawBoundaryRules.find((candidate) => candidate.adapter === item.adapter
    && candidate.tokens.some((pattern) => new RegExp(pattern).test(item.token)));
  return rule && !rule.file_suffixes.some((suffix) => item.file.endsWith(suffix));
});
check('adapter-implementation-boundary', rawBoundaryViolations.length === 0,
  rawBoundaryViolations.length === 0
    ? `raw runtime calls confined to declared boundaries (${rawBoundaryRules.length})`
    : rawBoundaryViolations.map((item) => `${item.file}:${item.token}`).join(', '));
const collectionSources = [
  text('pages/bookmarks/_db.flx'),
  text('pages/scratch/_db.flx'),
  text('pages/notes-afldb/_db.flx'),
  text('pages/todo-afldb/_db.flx'),
  text('pages/clips/_db.flx'),
  text('pages/events/api.flx'),
].join('\n');
check('collection-adapter-source', /front-collection-/.test(collectionSources)
  && !/\(afldb-coll-/.test(collectionSources),
  'AFJ-DB collection pages use the Front collection surface');

check('contract', contract.schema === 'fl-front-language/1' && contract.source.extension === '.flx', 'fl-front-language/1 + .flx source');
check('ssr', /\(defn\s+render\b/.test(all) && /layout-html/.test(all), 'render + layout-html in .flx pages');
check('api', /pages\/api/.test(flxFiles.join('\n')) && /server-json|server_json/.test(text('pages/api/hello.flx')), 'API route + server-json');
check('island', /\(island\s+/.test(all), 'Island declaration in .flx');
check('state', /\(defstore\s+/.test(all) && /\(dispatch\s+/.test(all), 'defstore + dispatch in .flx');
check('routing-static', fs.existsSync(path.join(PAGES, 'people', 'index.flx')), 'file route pages/people/index.flx');
check('routing-dynamic', fs.existsSync(path.join(PAGES, 'users', '[id].flx')), 'dynamic route pages/users/[id].flx');
const declaredBoundaries = (contract.browser_boundaries || []).map((item) => item.file).sort();
check('browser-boundary-inventory', JSON.stringify(rawScriptFiles) === JSON.stringify(declaredBoundaries),
  `raw_script_files=${rawScriptFiles.length} declared=${declaredBoundaries.length}`);
const bridgeSource = text(contract.browser_bridge?.source || 'pages/_layout.flx');
const bridgeModules = contract.browser_bridge?.modules || [];
const missingBridgeModules = bridgeModules.filter((module) => !bridgeSource.includes(`(define ${module.symbol}`));
check('browser-bridge-contract', missingBridgeModules.length === 0 && bridgeModules.length === 7,
  `modules=${bridgeModules.length} missing=${missingBridgeModules.map((module) => module.id).join(',') || 'none'}`);
check('browser-artifact-date-primitive', generated.includes('match(/^(\\\\d{4})-(\\\\d{2})-(\\\\d{2})$/)'),
  'generated browser artifact preserves date-add-days regex escapes');
const logsSource = text('pages/logs.flx');
check('browser-boundary-absorption', !/<script[\s>]/i.test(logsSource), 'logs polling has no raw script tag');
const notesSource = text('pages/notes.flx');
check('notes-server-ui', !/<script[\s>]|\bon(click|blur|keydown)=|addEventListener|function\s+(startEdit|saveEdit)/i.test(notesSource),
  'notes edit/search/color flows are FreeLang server forms without inline JavaScript');
const notesDeleteSource = text('pages/api/notes/[id]/delete.flx');
const notesPinSource = text('pages/api/notes/[id]/pin.flx');
check('adapter-db-route-method', /\(defn\s+render_post\b/.test(notesDeleteSource)
  && /\(defn\s+render_post\b/.test(notesPinSource)
  && /front-db-exec/.test(notesDeleteSource + notesPinSource),
  'dynamic note mutations use the Front DB surface and POST route contract');
const demoSource = text('pages/demo.flx');
check('demo-shared-router', !/<script[\s>]/i.test(demoSource) && /data-spa/.test(demoSource),
  'demo delegates SPA navigation to the shared layout bridge');
const customMetricsSource = text('pages/dashboard/custom-metrics.flx');
check('custom-metrics-server-ui', !/<script[\s>]/i.test(customMetricsSource)
  && /\(defn\s+render_post\b/.test(customMetricsSource)
  && /create-custom-metric/.test(customMetricsSource),
  'custom metrics list/create flows are FreeLang SSR and POST forms');
const alertsSource = text('pages/dashboard/alerts.flx');
check('alerts-island-ui', !/<script[\s>]/i.test(alertsSource)
  && /\(island\s+AlertsDashboard/.test(alertsSource)
  && /fetch!/.test(alertsSource)
  && /every!/.test(alertsSource),
  'alerts fetch/render/refresh flows are FreeLang Island code');
const operationsSource = text('pages/dashboard/operations.flx');
check('operations-server-ui', !/<script[\s>]/i.test(operationsSource)
  && /\(defn\s+probe-service\b/.test(operationsSource)
  && /front-http-get/.test(operationsSource)
  && /layout-html/.test(operationsSource),
  'operations service probes run in FreeLang SSR');
const httpUiSources = [
  operationsSource,
  text('pages/shop/index.flx'),
  text('pages/shop/products/[id].flx'),
  text('pages/shop/orders/[id].flx'),
  text('pages/shop/users/[id].flx'),
].join('\n');
check('http-adapter-source', /front-http-get/.test(httpUiSources) && !/\(http-get\b/.test(httpUiSources),
  'SSR service and shop pages use the Front HTTP surface instead of FX http-get');
const dashboardSource = text('pages/dashboard/index.flx');
check('dashboard-island-ui', !/<script[\s>]/i.test(dashboardSource)
  && /\(island\s+DashboardMetrics/.test(dashboardSource)
  && /fetch!/.test(dashboardSource)
  && /every!/.test(dashboardSource)
  && /export\?format=csv/.test(dashboardSource),
  'metrics dashboard uses FreeLang Island data flow and native export links');
const chartsSource = text('pages/dashboard/charts.flx');
check('charts-ssr-ui', !/<script[\s>]|Chart\.js|canvas/i.test(chartsSource)
  && /chart-line/.test(chartsSource)
  && /layout-html/.test(chartsSource),
  'charts use the FreeLang SVG helper in SSR');
const uploadSource = text('pages/upload.flx');
check('upload-server-form', !/\bon(change|input|click)=|addEventListener|js-eval/i.test(uploadSource)
  && /enctype='multipart\/form-data'/.test(uploadSource),
  'upload selection and submission stay in the FreeLang server form contract');
const errorStatsSource = text('pages/api/errors-stats.flx');
check('error-stats-server-form', !/<script[\s>]|\bon(click|change|submit)=|fetch\(/i.test(errorStatsSource)
  && /\(defn\s+render_post\b/.test(errorStatsSource)
  && /clear-errors/.test(errorStatsSource),
  'error clearing uses a FreeLang POST form and server redirect');
const flashStudySource = text('pages/flash/study.flx');
check('flash-native-disclosure', !/\bon(click|change|input)=|js-eval|document\./i.test(flashStudySource)
  && /\(h "details"/.test(flashStudySource)
  && /\(h "summary"/.test(flashStudySource),
  'flash card disclosure uses native HTML details without page JavaScript');
const vaultSource = text('pages/vault/index.flx');
const promptsSource = text('pages/prompts/index.flx');
check('clipboard-primitive-source', !/js-eval|navigator\.clipboard|\.-clipboard|\.-navigator/i.test(vaultSource + promptsSource)
  && /\(copy!/.test(vaultSource)
  && /\(copy!/.test(promptsSource),
  'vault and prompts use the FreeLang copy! primitive instead of browser expressions');
const copyRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/examples/36-copy-contract.flx'),
  '--island=CopyContract', '--click=button',
], { cwd: ROOT, encoding: 'utf8' });
let copyResult = null;
try { copyResult = JSON.parse(copyRunner.stdout); } catch (_) {}
check('copy-primitive-runtime', copyRunner.status === 0 && copyResult?.ok === true
  && copyResult?.results?.[0]?.events?.some((event) => event.type === 'copy'
    && event.value === 'freelang-front-copy-contract'),
  'headless CopyContract executes copy! through the browser adapter');
const dashboardRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/dashboard/index.flx'),
  '--island=DashboardMetrics',
], { cwd: ROOT, encoding: 'utf8' });
let dashboardResult = null;
try { dashboardResult = JSON.parse(dashboardRunner.stdout); } catch (_) {}
const dashboardEvents = dashboardResult?.results?.[0]?.events || [];
check('dashboard-island-runtime', dashboardRunner.status === 0 && dashboardResult?.ok === true
  && dashboardEvents.some((event) => event.type === 'fetch')
  && dashboardEvents.some((event) => event.type === 'every'),
  'headless DashboardMetrics executes fetch! and every!');
const alertsRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/dashboard/alerts.flx'),
  '--island=AlertsDashboard',
], { cwd: ROOT, encoding: 'utf8' });
let alertsResult = null;
try { alertsResult = JSON.parse(alertsRunner.stdout); } catch (_) {}
const alertEvents = alertsResult?.results?.[0]?.events || [];
check('alerts-island-runtime', alertsRunner.status === 0 && alertsResult?.ok === true
  && alertEvents.some((event) => event.type === 'fetch')
  && alertEvents.some((event) => event.type === 'every'),
  'headless AlertsDashboard executes fetch! and every!');

const runner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/examples/34-state-contract.flx'),
  '--island=statewriter', '--click=button',
], { cwd: ROOT, encoding: 'utf8' });
let result = null;
try { result = JSON.parse(runner.stdout); } catch (_) {}
const row = result?.results?.[0];
check('island-runtime', runner.status === 0 && result?.ok === true && row?.store?.['state-message'] === 'updated', 'headless statewriter dispatch execution');

const logsRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/logs.flx'),
  '--island=logpoller',
], { cwd: ROOT, encoding: 'utf8' });
let logsResult = null;
try { logsResult = JSON.parse(logsRunner.stdout); } catch (_) {}
const logEvents = logsResult?.results?.[0]?.events || [];
check('browser-boundary-runtime', logsRunner.status === 0 && logsResult?.ok === true
  && logEvents.some((event) => event.type === 'fetch')
  && logEvents.some((event) => event.type === 'every'), 'FreeLang every! + fetch! replace raw polling script');

const dateRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/examples/35-date-contract.flx'),
  '--island=DateContract',
], { cwd: ROOT, encoding: 'utf8' });
let dateResult = null;
try { dateResult = JSON.parse(dateRunner.stdout); } catch (_) {}
check('date-primitive-runtime', dateRunner.status === 0 && dateResult?.ok === true
  && dateResult?.results?.[0]?.html?.includes('2024-03-01')
  && dateResult?.results?.[0]?.events?.some((event) => event.type === 'date-add-days'),
  'FreeLang date-add-days handles leap-year boundary in headless runtime');

const eventStreamRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/examples/37-event-stream-contract.flx'),
  '--island=EventStreamContract',
], { cwd: ROOT, encoding: 'utf8' });
let eventStreamResult = null;
try { eventStreamResult = JSON.parse(eventStreamRunner.stdout); } catch (_) {}
const eventStreamEvents = eventStreamResult?.results?.[0]?.events || [];
check('event-stream-primitive-runtime', eventStreamRunner.status === 0
  && eventStreamResult?.ok === true
  && eventStreamEvents.some((event) => event.type === 'event-stream'
    && event.url === '/api/metrics/stream')
  && eventStreamEvents.some((event) => event.type === 'render'),
  'FreeLang event-stream! opens the browser bridge and delivers the headless callback');

const propsRunner = spawnSync(process.execPath, [
  path.join(ROOT, 'island-runner.js'),
  path.join(ROOT, 'pages/shop/products/[id].flx'),
  '--island=AddToCart',
  '--props={"product-id":42,"stock":3}',
], { cwd: ROOT, encoding: 'utf8' });
let propsResult = null;
try { propsResult = JSON.parse(propsRunner.stdout); } catch (_) {}
check('island-props-runtime', propsRunner.status === 0 && propsResult?.ok === true
  && propsResult?.results?.[0]?.html?.includes('🛒 장바구니 담기')
  && !propsResult?.results?.[0]?.html?.includes('품절'),
  'server data-fl-props reaches the FreeLang Island without window globals');

const pass = checks.every((item) => item.status === 'PASS');
const output = { schema: 'fl-front-conformance/1', tool: 'freelang-front', source_files: flxFiles.length, checks, pass };
console.log(JSON.stringify(output));
process.exit(pass ? 0 : 1);
