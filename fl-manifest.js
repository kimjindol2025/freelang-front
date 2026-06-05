#!/usr/bin/env node
'use strict';
// ════════════════════════════════════════════════════════════════════
// fl-manifest — FreeLang 이 자기를 기계(AI 에이전트)에게 서술한다.
// "잘못 쓴 뒤 잡아주는(Trap Checker)" 게 아니라 "잘못 쓰기 전에 알려준다".
//
// 원칙: 수동 문서 금지. 전부 코드/런타임에서 자동 생성 → 문서·구현 분리 불가.
//   · builtins        : 런타임 `bootstrap.js ls-fns` 자기열거(name [args] → returns, 카테고리)
//   · frontHelpers    : fl-front-build.js 의 FL_FRONT_HELPERS Set
//   · diagnosticCodes : fl-front-build.js 의 issue(...) 호출에서 쓰는 check 코드
//
// 사용: node fl-manifest.js [--json]   (기본 출력이 JSON)
// ════════════════════════════════════════════════════════════════════

const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const ROOT = __dirname;
const BOOTSTRAP = path.join(ROOT, 'runtime', 'bootstrap.js');
const BUILD_JS = path.join(ROOT, 'fl-front-build.js');
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');

// 런타임을 한 번 실행해 출력을 얻는다 (exit code 무관하게 stdout 확보)
function runNode(args) {
  try { return cp.execSync(`node ${args}`, { cwd: ROOT, timeout: 20000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
  catch (e) { return ((e.stdout || '') + (e.stderr || '')).toString(); }
}

// FreeLang 버전 — 배너에서 파싱
function flVersion() {
  const m = stripAnsi(runNode(`${JSON.stringify(BOOTSTRAP)}`)).match(/FreeLang\s+v?([\w.\-]+)/i);
  return m ? m[1] : 'unknown';
}

// args 토큰 정규화: [x] → x?(선택), ...x → 그대로(가변)
function normArgs(s) {
  if (!s) return [];
  return s.trim().split(/\s+/).filter(Boolean).map(t => /^\[.*\]$/.test(t) ? t.slice(1, -1) + '?' : t);
}

// 런타임 ls-fns 자기열거 파싱 → [{name, category, args, returns}]
function builtinsFromRuntime() {
  const raw = stripAnsi(runNode(`${JSON.stringify(BOOTSTRAP)} ls-fns`));
  const builtins = [];
  const categories = {};
  let cat = 'misc';
  for (const line of raw.split('\n')) {
    const head = line.match(/^([\w.\-]+)\s+\((\d+)\)\s*$/);     // "agent (24)"
    if (head) { cat = head[1]; categories[cat] = Number(head[2]); continue; }
    const fn = line.match(/^ {2}([^\s]+)(?:\s+(.+?))?\s*→\s*(.+)$/); // "  name args → returns"
    if (fn) {
      const runtimeName = fn[1];
      const name = runtimeName.replace(/_/g, '-');   // FL 코드 관례 = 하이픈
      const b = { name, category: cat, args: normArgs(fn[2]), returns: fn[3].trim() };
      if (name !== runtimeName) b.aliases = [runtimeName];   // 언더스코어 형도 호출 가능
      builtins.push(b);
    }
  }
  return { builtins, categories };
}

// fl-front-build.js 에서 FL_FRONT_HELPERS Set 리터럴 파싱
function frontHelpers() {
  let src; try { src = fs.readFileSync(BUILD_JS, 'utf8'); } catch { return []; }
  const m = src.match(/FL_FRONT_HELPERS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) return [];
  return [...new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]))];
}

// fl-front-build.js 의 issue(level, check, ...) 에서 쓰는 진단 코드 자동 추출
function diagnosticCodes() {
  let src; try { src = fs.readFileSync(BUILD_JS, 'utf8'); } catch { return []; }
  const codes = new Set();
  for (const m of src.matchAll(/issue\(\s*'(?:error|warn)'\s*,\s*'([^']+)'/g)) codes.add(m[1]);
  return [...codes].sort();
}

function manifest() {
  const { builtins, categories } = builtinsFromRuntime();
  const fh = frontHelpers();
  const builtinNames = new Set(builtins.map(b => b.name));
  return {
    schema: 'fl-manifest/1',
    tool: 'freelang',
    version: flVersion(),
    note: '잘못 쓰기 전에 조회하세요 — 여기 없는 이름은 호출 금지(존재하지 않음).',
    builtinCount: builtins.length,
    categories,
    builtins,
    // 프론트 전용 헬퍼(런타임 빌트인과 중복 제외) — freelang-front 컨텍스트에서 추가로 호출 가능
    frontHelpers: fh.filter(n => !builtinNames.has(n)).sort(),
    diagnosticCodes: diagnosticCodes(),
  };
}

console.log(JSON.stringify(manifest(), null, 2));
