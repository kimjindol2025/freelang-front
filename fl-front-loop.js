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
 * schema: fl-loop/1  (필드 추가만 — 기존 키 제거·개명 금지)
 *
 * 의미:
 *   converged = machine-applicable 잔여 0 ("더 이상 자동으로 고칠 게 없음")
 *   humanShare > 0 이면 사람 판단 필요 진단이 남아 있음 (converged와 독립)
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

function isMachineApplicableDiag(d, allowed) {
  if (!d || !d.code) return false;
  if (allowed.has(d.code)) return true;
  if (d.applicability === 'machine-applicable') return true;
  if (d.fixable === true && allowed.has(d.code)) return true;
  return false;
}

function collectFixable(diagnostics, allowed) {
  return (diagnostics || []).filter(d => isMachineApplicableDiag(d, allowed));
}

/** 사람 몫 — MA가 아닌 진단 (converged와 독립) */
function collectHumanShare(diagnostics, allowed) {
  return (diagnostics || [])
    .filter(d => d && d.code && !isMachineApplicableDiag(d, allowed))
    .map(d => ({
      code: d.code,
      file: d.file || '',
      line: d.line || 0,
      message: d.message || '',
      reason:
        d.hint ||
        (d.applicability === 'has-suggestions'
          ? 'has-suggestions — 자동적용 위험, 사람 판단'
          : d.applicability === 'manual'
            ? 'manual — 사람·에이전트 판단 필요'
            : 'not machine-applicable'),
    }));
}

function uniqueCodes(diags) {
  return [...new Set(diags.map(d => d.code))].sort();
}

function summarizeAutoFixed(rounds) {
  const codes = new Set();
  let filesChanged = 0;
  for (const r of rounds) {
    const fix = r.fix;
    if (!fix || fix.dry || !fix.results) continue;
    filesChanged += fix.filesChanged || 0;
    for (const file of fix.results) {
      for (const a of file.applied || []) {
        if (a.code) codes.add(a.code);
      }
    }
  }
  return {
    filesChanged,
    codes: [...codes].sort(),
  };
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
    const human = collectHumanShare(lastDiag.diagnostics, allowed);
    const round = {
      n: i + 1,
      ok: !!lastDiag.ok,
      summary: lastDiag.summary || null,
      fixableCount: fixable.length,
      fixableCodes: uniqueCodes(fixable),
      humanShare: human.length,
      humanShareCodes: uniqueCodes(human),
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
    const human = collectHumanShare(lastDiag.diagnostics, allowed);
    const finalRound = {
      n: 'final',
      ok: !!lastDiag.ok,
      summary: lastDiag.summary || null,
      fixableCount: fixable.length,
      fixableCodes: uniqueCodes(fixable),
      humanShare: human.length,
      humanShareCodes: uniqueCodes(human),
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
  const humanItems = collectHumanShare((lastDiag && lastDiag.diagnostics) || [], allowed);
  const autoFixed = summarizeAutoFixed(rounds);

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
    // ── 추가 필드 (fl-loop/1 호환) ──
    humanShare: humanItems.length,
    humanShareItems: humanItems,
    autoFixed,
    meaning: {
      converged: 'no remaining machine-applicable fixes (자동으로 더 고칠 것 없음)',
      humanShare: 'diagnostics requiring human judgment (사람 몫; converged와 독립)',
      note: 'converged ≠ humanShare 0',
    },
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

module.exports = { runLoop, collectFixable, collectHumanShare };
