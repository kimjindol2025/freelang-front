#!/usr/bin/env node
'use strict';

// Front scaffold가 파일을 쓰기 전에 AI가 계획과 입력 오류를 결정적으로 확인하는 계약.
const { spawnSync } = require('node:child_process');

function run(args) {
  return spawnSync(process.execPath, ['fl-scaffold.js', ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
}

const planned = run(['--ns', 'ai_notes', '--fields', 'title,content', '--name', 'ai_notes', '--dry']);
let plan = null;
try { plan = JSON.parse(planned.stdout); } catch {}

const blockedField = run(['--ns', 'ai_notes', '--fields', 'text', '--name', 'ai_notes', '--dry']);
const blockedPath = run(['--ns', '../escape', '--fields', 'title', '--dry']);
const pass = planned.status === 0
  && plan?.schema === 'fl-scaffold/1'
  && plan?.dry === true
  && plan?.planned?.some((item) => item.includes('pages/ai_notes/index.flx'))
  && blockedField.status !== 0
  && /blocked/i.test(blockedField.stderr)
  && blockedPath.status !== 0;

console.log(JSON.stringify({
  schema: 'fl-front-scaffold-contract/1',
  pass,
  checks: [
    { name: 'dry-plan', pass: planned.status === 0 && plan?.dry === true },
    { name: 'planned-files', pass: plan?.planned?.length === 4 },
    { name: 'blocked-field', pass: blockedField.status !== 0 && /blocked/i.test(blockedField.stderr) },
    { name: 'blocked-path', pass: blockedPath.status !== 0 },
  ],
}));
process.exit(pass ? 0 : 1);
