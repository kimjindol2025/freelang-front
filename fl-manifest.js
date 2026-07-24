#!/usr/bin/env node
/**
 * fl-manifest.js — FreeLang Front AI manifest (작성 전 조회용)
 * schema: fl-manifest/1
 *
 * Phase 2: diagnosticCodes 카탈로그 포함
 * (라우트/헬퍼 목록은 빌드 산출 .build-state.json 또는 /~ai 참고)
 *
 *   node fl-manifest.js
 *   node fl-manifest.js --json   (동일, 명시)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { DIAGNOSTIC_CODES, machineApplicable, schema: codesSchema } = require('./fl-diagnostic-codes');

const PKG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); }
  catch { return { version: '0.0.0' }; }
})();

const BUILD_STATE_PATH = path.join(__dirname, '.build-state.json');

function loadBuildExtras() {
  try {
    const s = JSON.parse(fs.readFileSync(BUILD_STATE_PATH, 'utf8'));
    return {
      routes: (s.routes || []).map(r => r.route),
      helpers: s.helpers || [],
      store_keys: s.store_keys || [],
      lastBuildOk: !!s.ok,
      lastBuildSummary: s.summary || null,
    };
  } catch {
    return { routes: [], helpers: [], store_keys: [], lastBuildOk: null, lastBuildSummary: null };
  }
}

const extras = loadBuildExtras();

const manifest = {
  schema: 'fl-manifest/1',
  tool: 'freelang-front',
  version: PKG.version || '0.2.5',
  codesSchema,
  diagnosticCodes: DIAGNOSTIC_CODES,
  summary: {
    diagnosticCodeCount: DIAGNOSTIC_CODES.length,
    machineApplicable: machineApplicable().map(c => c.code),
    errors: DIAGNOSTIC_CODES.filter(c => c.severity === 'error').length,
    warnings: DIAGNOSTIC_CODES.filter(c => c.severity === 'warning').length,
  },
  // 빌드 후 스냅샷 (없으면 빈 배열) — 작성 전 “무엇이 있는지” 힌트
  routes: extras.routes,
  helpers: extras.helpers,
  store_keys: extras.store_keys,
  lastBuild: {
    ok: extras.lastBuildOk,
    summary: extras.lastBuildSummary,
  },
  traps: [
    'json-parse-hyphen',
    'upper-hyphen',
    'let-shadow',
    'fl-http-allow',
    'helper-load-order',
    'req-key-collision',
  ],
  // afl-db 컬렉션 앱 작성 전 계약 (콜드스타트용 — 기존 앱 소스 불필요)
  afldbColl: {
    docs: 'docs/AFLDB-COLL.md',
    namespacesDefine: 'pages/_afldb_coll.flx → afldb_coll_namespaces (append only)',
    keys: {
      index: 'fl:<ns>:index',
      item: 'fl:<ns>:item:<id>',
    },
    api: [
      'afldb-coll-create',
      'afldb-coll-update',
      'afldb-coll-delete',
      'afldb-coll-all',
      'afldb-coll-get',
      'afldb-coll-history',
      'afldb-coll-known',
      'afldb-status',
    ],
    scaffold: {
      dir: 'pages/<name>/',
      files: ['_db.flx', 'api.flx', 'index.flx'],
      routes: ['/<name>', '/<name>/api'],
      note: '기존 라우트와 충돌하면 /<name>-afldb (docs/TRAPS.md). manifest.routes 로 충돌 확인.',
    },
    thinDbRule: '인덱스·키 조립 금지 — afldb-coll-* 만 호출. 도메인 필드만 _db에.',
  },
  docs: {
    traps: 'docs/TRAPS.md',
    afldbColl: 'docs/AFLDB-COLL.md',
    roadmap: 'docs/AI-INTERFACE-ROADMAP.md',
    checkpoint: 'CHECKPOINT_2026-07-25.md',
  },
  verification: {
    // Phase0 fl-manifest 검증 체크리스트 (8/8)
    items: [
      'schema fl-manifest/1',
      'diagnosticCodes + codesSchema',
      'summary (count / machineApplicable)',
      'routes snapshot',
      'helpers snapshot',
      'store_keys + lastBuild',
      'traps == 활성 Trap 목록',
      'docs.afldbColl + afldbColl 계약 블록',
    ],
    score: '8/8',
  },
};

process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
