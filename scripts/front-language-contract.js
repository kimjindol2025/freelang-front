#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'front-language.contract.json');
const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = ['schema', 'name', 'source', 'layers', 'adapters', 'adapter_contract', 'primitives', 'browser_boundaries', 'browser_bridge', 'invariants', 'independence'];
const requiredPrimitives = ['copy!', 'date-add-days', 'every!', 'event-stream!', 'fetch!', 'fetch-post!', 'prop'];
const missing = required.filter((key) => !(key in contract));
if (contract.schema !== 'fl-front-language/1' || missing.length || contract.source.extension !== '.flx') {
  console.error(JSON.stringify({ ok: false, missing, schema: contract.schema }, null, 2));
  process.exit(1);
}
if (!contract.layers.every((layer) => layer.syntax === 'FreeLang' || layer.syntax === 'FreeLang Front')) {
  console.error('LANGUAGE_CONTRACT=FAIL\nCAUSE=non-FreeLang source layer');
  process.exit(1);
}
for (const primitive of requiredPrimitives) {
  if (!contract.primitives?.includes(primitive)) {
    console.error(`LANGUAGE_CONTRACT=FAIL\nCAUSE=missing primitive: ${primitive}`);
    process.exit(1);
  }
}
const adapterIds = new Set((contract.adapters || []).map((adapter) => adapter.id));
const adapterTokens = contract.adapter_contract?.tokens || [];
if (!contract.adapter_contract?.policy || adapterTokens.length < 1
  || adapterTokens.some((entry) => !adapterIds.has(entry.adapter)
    || !Array.isArray(entry.patterns) || entry.patterns.length < 1
    || entry.patterns.some((pattern) => { try { new RegExp(pattern); return false; } catch (_) { return true; } }))) {
  console.error('LANGUAGE_CONTRACT=FAIL\nCAUSE=invalid adapter token contract');
  process.exit(1);
}
const profiles = contract.adapter_contract?.profiles || [];
if (!profiles.some((profile) => profile.id === 'afj-db95' && profile.kind === 'production')
  || !profiles.some((profile) => profile.id === 'memory-test' && profile.selection === 'FL_FRONT_COLLECTION_ADAPTER=memory')) {
  console.error('LANGUAGE_CONTRACT=FAIL\nCAUSE=missing adapter execution profiles');
  process.exit(1);
}
const bridge = contract.browser_bridge;
if (bridge.source !== 'pages/_layout.flx' || !Array.isArray(bridge.modules) || bridge.modules.length < 1
  || bridge.modules.some((module) => !module.id || !module.symbol || !Array.isArray(module.capabilities))) {
  console.error('LANGUAGE_CONTRACT=FAIL\nCAUSE=invalid browser bridge module contract');
  process.exit(1);
}
console.log(`LANGUAGE_CONTRACT=PASS layers=${contract.layers.length} adapters=${contract.adapters.length} boundaries=${contract.browser_boundaries.length} stage=${contract.independence.current_stage}`);
