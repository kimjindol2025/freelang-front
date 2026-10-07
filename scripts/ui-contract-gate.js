#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'pages', '_ui.flx');
const source = fs.readFileSync(sourcePath, 'utf8');
const required = {
  atoms: ['ui-btn', 'ui-badge', 'ui-avatar', 'ui-divider', 'ui-spinner'],
  forms: ['ui-input', 'ui-textarea', 'ui-select', 'ui-checkbox', 'ui-form-group'],
  layout: ['ui-card', 'ui-grid', 'ui-stack', 'ui-row'],
  feedback: ['ui-alert', 'ui-empty', 'ui-progress'],
  data: ['ui-table', 'ui-stat', 'ui-tags'],
};
const forbidden = [
  { token: 'string?', reason: 'Front runtime has no string? builtin' },
  { token: 'nil?', reason: 'Front source uses (= value nil)' },
  { token: 'server-req-body', reason: 'POST body is (get req "body")' },
];

const components = Object.fromEntries(Object.entries(required).map(([group, names]) => [
  group,
  names.map((name) => ({ name, present: new RegExp(`\\(defn\\s+${name}\\b`).test(source) })),
]));
const missing = Object.values(components).flat().filter((item) => !item.present);
const violations = forbidden.filter((item) => source.includes(item.token));
const result = {
  schema: 'fl-ui-contract/1',
  tool: 'freelang-front',
  source: 'pages/_ui.flx',
  pass: missing.length === 0 && violations.length === 0,
  components,
  missing,
  violations,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.pass ? 0 : 1);
