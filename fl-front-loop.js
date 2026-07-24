#!/usr/bin/env node
/**
 * fl-front-loop.js — Phase 4 자가수정 루프
 *
 *   manifest 조회 → fl-build --json → machine-applicable만 fix → 재검사 → 수렴
 *
 *   node fl-front-loop.js           # 적용하며 수렴
 *   node fl-front-loop.js --dry     # 진단만 (수정 없음)
 *   FL_LOOP_MAX=3 node fl-front-loop.js
 *
 * schema: fl-loop/1
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { runFix } = require('./fl-front-fix');
const { machineApplicable } = require('./fl-diagnostic-codes');

const ROOT = __dirname;
const DRY = process.argv.includes('--dry');
const MAX = Math.max(1, parseInt(process.env.FL_LOOP_MAX || '5', 10) || 5);

function runNode(script, args = []) {
  const env = {
    ...process.env,
    FL_HTTP_ALLOW: process.env.FL_HTTP_ALLOW || '127.0.0.1,localhost',
  };
  return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    encoding: 'utf8',
    env,
    maxBuffer: 32 * 1024 * 1024,
    cwd: ROOT,
  });
}

function loadManifest() {
  const r = runNode('fl-manifest.js');
  if (r.error) throw r.error;
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    throw new Error(`fl-manifest.js JSON 파싱 실패: ${e.message}\n${(r.stdout || '').slice(0, 400)}`);
  }
}

function buildJson() {
  const r = runNode('fl-front-build.js', ['--json']);
  // error exit여도 JSON은 stdout에 올 수 있음
  const text = (r.stdout || '').trim();
  if (!text) {
    return {
      ok: false,
      schema: 'fl-diagnostics/1',
      diagnostics: [],
      summary: { errors: 1, warnings: 0 },
      _spawn: { status: r.status, stderr: (r.stderr || '').slice(0, 800) },
    };
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      schema: 'fl-diagnostics/1',
      diagnostics: [],
      summary: { errors: 1, warnings: 0 },
      _parseError: e.message,
      _stdoutHead: text.slice(0, 400),
    };
  }
}

function collectFixable(diagnostics, allowed) {
  const list = diagnostics || [];
  return list.filter(d => {
    if (allowed.has(d.code)) return true;
    if (d.applicability === 'machine-applicable') return true;
    if (d.fixable === true && allowed.has(d.code)) return true;
    return false;
  });
}

function uniqueCodes(diags) {
  return [...new Set(diags.map(d => d.code))].sort();
}

function runLoop() {
  const manifest = loadManifest();
  const fromManifest = (manifest.summary && manifest.summary.machineApplicable) || [];
  const allowed = new Set(
    fromManifest.length ? fromManifest : machineApplicable().map(c => c.code)
  );

  const rounds = [];
  let converged = false;
  let reason = '';
  let lastDiag = null;

  for (let i = 0; i < MAX; i++) {
    lastDiag = buildJson();
    const fixable = collectFixable(lastDiag.diagnostics, allowed);
    const round = {
      n: i + 1,
      ok: !!lastDiag.ok,
      summary: lastDiag.summary || null,
      fixableCount: fixable.length,
      fixableCodes: uniqueCodes(fixable),
    };

    if (fixable.length === 0) {
      converged = true;
      reason = i === 0 ? 'already-clean' : 'converged';
      rounds.push(round);
      break;
    }

    if (DRY) {
      round.fix = { dry: true, applied: false };
      rounds.push(round);
      reason = 'dry-run';
      break;
    }

    const fixReport = runFix({ dry: false });
    round.fix = {
      dry: false,
      filesChanged: fixReport.filesChanged,
      results: fixReport.results,
    };
    rounds.push(round);

    if (fixReport.filesChanged === 0) {
      reason = 'fix-noop'; // 진단은 있는데 fixer가 못 고침 → 루프 중단
      break;
    }
  }

  if (!converged && reason !== 'dry-run') {
    lastDiag = buildJson();
    const fixable = collectFixable(lastDiag.diagnostics, allowed);
    const finalRound = {
      n: 'final',
      ok: !!lastDiag.ok,
      summary: lastDiag.summary || null,
      fixableCount: fixable.length,
      fixableCodes: uniqueCodes(fixable),
    };
    rounds.push(finalRound);
    if (fixable.length === 0) {
      converged = true;
      reason = reason === 'fix-noop' ? 'fix-noop-but-clean' : 'converged';
    } else if (!reason) {
      reason = 'max-iterations';
    }
  }

  const remaining = collectFixable((lastDiag && lastDiag.diagnostics) || [], allowed);

  return {
    schema: 'fl-loop/1',
    tool: 'freelang-front',
    dry: DRY,
    max: MAX,
    converged,
    reason,
    machineApplicable: [...allowed].sort(),
    remainingFixable: uniqueCodes(remaining),
    remainingFixableCount: remaining.length,
    buildOk: !!(lastDiag && lastDiag.ok),
    lastSummary: (lastDiag && lastDiag.summary) || null,
    rounds,
    manifest: {
      schema: manifest.schema,
      summary: manifest.summary,
    },
  };
}

const report = runLoop();
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(report.converged || report.dry ? 0 : 1);

module.exports = { runLoop, collectFixable };
