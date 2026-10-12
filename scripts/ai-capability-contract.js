#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'ai-capabilities.json');
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
const requiredFields = ['id', 'when', 'source', 'operations', 'input', 'output', 'permissions', 'risk', 'verification'];
const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
const errors = [];
if (registry.schema !== 'fl-front-ai-capabilities/1' || registry.audience !== 'AI') errors.push('schema/audience');
for (const capability of capabilities) {
  for (const field of requiredFields) if (!(field in capability)) errors.push(`${capability.id}:missing:${field}`);
  if (!capability.source || !capability.source.split(' + ').every(source => fs.existsSync(path.join(ROOT, source)))) {
    errors.push(`${capability.id}:source`);
  }
  if (!Array.isArray(capability.when) || capability.when.length === 0) errors.push(`${capability.id}:when`);
  if (!Array.isArray(capability.verification) || capability.verification.length === 0) errors.push(`${capability.id}:verification`);
}
const samples = [
  ['로그인 권한이 필요한 페이지', 'auth'],
  ['DB에 목록을 저장하고 검색', 'data'],
  ['폼과 테이블 화면 만들기', 'ui'],
  ['오류를 재현하고 회귀 검수', 'test'],
  ['입력 필수값을 검증', 'schema'],
  ['재현 데이터를 seed하고 초기화', 'fixture'],
];
const selected = samples.map(([task, expected]) => {
  const match = capabilities
    .map(capability => ({ capability, score: Math.max(0, ...capability.when.filter(word => task.includes(word)).map(word => word.length)) }))
    .sort((a, b) => b.score - a.score)[0]?.capability;
  return { task, expected, selected: match?.id || null, pass: match?.id === expected };
});
const result = {
  schema: 'fl-front-ai-capability-contract/1',
  pass: errors.length === 0 && capabilities.length === 6 && selected.every(item => item.pass),
  capability_count: capabilities.length,
  errors,
  selected,
  deferred: registry.deferred,
};
console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 2);
