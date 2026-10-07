#!/usr/bin/env node

/*
 * AI-facing Front gate.
 * The compiler and manifest remain the source of truth; this script only
 * normalizes their evidence into one deterministic JSON result.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const jsonOnly = process.argv.includes('--json');

function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FL_HTTP_ALLOW: '127.0.0.1,localhost' },
  });
  return {
    command: [process.execPath, file, ...args].join(' '),
    code: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseJson(output) {
  const text = output.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch (_) {}
  }
  const starts = [...text.matchAll(/\{/g)].map((m) => m.index).reverse();
  for (const start of starts) {
    try { return JSON.parse(text.slice(start)); } catch (_) {}
  }
  return null;
}

function check(name, ok, detail) {
  return { name, status: ok ? 'PASS' : 'FAIL', detail };
}

const build = run('fl-front-build.js', ['--json']);
const buildJson = parseJson(build.stdout);
const manifest = run('fl-manifest.js', ['--json']);
const manifestJson = parseJson(manifest.stdout);
let commit = 'UNKNOWN';
try {
  const headFile = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
  if (headFile.startsWith('ref: ')) {
    commit = fs.readFileSync(path.join(root, '.git', headFile.slice(5)), 'utf8').trim();
  } else {
    commit = headFile;
  }
} catch (_) {}

const diagnostics = Array.isArray(buildJson?.issues) ? buildJson.issues : [];
const errors = diagnostics.filter((issue) => issue.severity === 'error');
const checks = [
  check('build_exit', build.code === 0, `exit=${build.code}`),
  check('build_json', Boolean(buildJson), 'expected compiler JSON output'),
  check('diagnostics', errors.length === 0, `issues=${diagnostics.length} errors=${errors.length}`),
  check('manifest_schema', manifest.code === 0 && manifestJson?.schema === 'fl-manifest/1',
    manifestJson?.schema || `exit=${manifest.code}`),
];

const result = {
  schema: 'fl-ai-gate/1',
  tool: 'freelang-front',
  repoCommit: commit,
  pass: checks.every((item) => item.status === 'PASS'),
  checks,
  build: buildJson || { exit: build.code },
  manifest: manifestJson || { exit: manifest.code },
};

if (jsonOnly || !process.stdout.isTTY) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  for (const item of checks) console.log(`${item.name}=${item.status} ${item.detail}`);
  console.log(`AI_GATE=${result.pass ? 'PASS' : 'FAIL'} COMMIT=${commit}`);
}
process.exit(result.pass ? 0 : 1);
