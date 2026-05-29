#!/usr/bin/env node
// style-compiler.js — (style name :key val ...) DSL → scoped .css

const fs   = require('fs');
const path = require('path');

// CSS 속성 매핑 (10개 이상)
const PROP_MAP = {
  ':bg':       'background',
  ':color':    'color',
  ':p':        'padding',
  ':pt':       'padding-top',
  ':pb':       'padding-bottom',
  ':pl':       'padding-left',
  ':pr':       'padding-right',
  ':m':        'margin',
  ':mt':       'margin-top',
  ':mb':       'margin-bottom',
  ':radius':   'border-radius',
  ':shadow':   'box-shadow',
  ':display':  'display',
  ':width':    'width',
  ':height':   'height',
  ':font':     'font-family',
  ':size':     'font-size',
  ':weight':   'font-weight',
  ':border':   'border',
  ':flex':     'flex',
  ':gap':      'gap',
  ':cols':     (v) => `grid-template-columns: repeat(${v}, 1fr)`,
  ':overflow': 'overflow',
  ':cursor':   'cursor',
  ':opacity':  'opacity',
};

// shadow 단축값
const SHADOW_ALIAS = {
  'sm':  '0 1px 3px rgba(0,0,0,.12)',
  'md':  '0 4px 12px rgba(0,0,0,.15)',
  'lg':  '0 8px 24px rgba(0,0,0,.18)',
  'none':'none',
};

// djb2 해시 (4자리 hex)
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16).slice(0, 4);
}

// (style name :k1 v1 :k2 v2 ...) 파싱
function parseStyleBlock(block) {
  // 이름 추출
  const nameMatch = block.match(/^\(style\s+([\w-]+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  // :key "val" 쌍 추출
  const pairs = [];
  const pairRe = /(:[\w-]+)\s+"([^"]+)"/g;
  let m;
  while ((m = pairRe.exec(block)) !== null) {
    pairs.push([m[1], m[2]]);
  }
  // :key number 쌍 (따옴표 없는 숫자)
  const numRe = /(:[\w-]+)\s+(\d+)/g;
  while ((m = numRe.exec(block)) !== null) {
    if (!pairs.find(p => p[0] === m[1])) pairs.push([m[1], m[2]]);
  }

  return { name, pairs };
}

// CSS 규칙 생성
function buildCss(name, pairs) {
  const key = pairs.map(([k,v]) => `${k}=${v}`).join(';');
  const hash = hashStr(name + key);
  const cls  = name.replace(/-/g, '_') + '__' + hash;

  const decls = pairs.map(([k, v]) => {
    const prop = PROP_MAP[k];
    if (!prop) return null;
    // shadow alias
    if (k === ':shadow') v = SHADOW_ALIAS[v] || v;
    if (typeof prop === 'function') return prop(v) + ';';
    return `${prop}: ${v};`;
  }).filter(Boolean);

  return { cls, css: `.${cls} { ${decls.join(' ')} }` };
}

// .flx 파일에서 (style ...) 블록 추출
function extractStyles(content) {
  const results = [];
  // (style name ...) — 괄호 깊이 추적
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf('(style ', i);
    if (idx === -1) break;
    let depth = 0, j = idx;
    while (j < content.length) {
      if (content[j] === '(') depth++;
      else if (content[j] === ')') { depth--; if (depth === 0) { j++; break; } }
      j++;
    }
    const block = content.slice(idx, j);
    const parsed = parseStyleBlock(block);
    if (parsed) results.push({ ...parsed, block, start: idx, end: j });
    i = j;
  }
  return results;
}

// 메인 컴파일 함수
// pages 디렉토리 재귀 스캔 → styles/app.css 생성
// 반환값: { cssPath, bindings: [{name, cls}] }
function compile(pagesDir, outDir) {
  const allStyles = new Map(); // name → {cls, css}

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scanDir(full); continue; }
      if (!e.name.endsWith('.flx')) continue;
      const content = fs.readFileSync(full, 'utf8');
      for (const s of extractStyles(content)) {
        if (!allStyles.has(s.name)) {
          allStyles.set(s.name, buildCss(s.name, s.pairs));
        }
      }
    }
  }
  scanDir(pagesDir);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const cssPath = path.join(outDir, 'app.css');
  const cssLines = ['/* FL-Front 자동 생성 — 직접 수정 금지 */'];
  const bindings = [];

  for (const [name, { cls, css }] of allStyles) {
    cssLines.push(css);
    bindings.push({ name, cls });
  }

  fs.writeFileSync(cssPath, cssLines.join('\n') + '\n', 'utf8');
  return { cssPath, bindings };
}

// 단일 파일의 Critical CSS 생성
// 반환: { css: "<style>...</style>", bindings, rawCss }
function compilePageCSS(filePath) {
  const content  = fs.readFileSync(filePath, 'utf8');
  const styles   = extractStyles(content);
  if (!styles.length) return { css: '', bindings: [], rawCss: '' };

  const bindings = [];
  const rules    = [];
  for (const s of styles) {
    const { cls, css } = buildCss(s.name, s.pairs);
    bindings.push({ name: s.name, cls });
    rules.push(css);
  }
  const rawCss = rules.join(' ');
  return { css: `<style>${rawCss}</style>`, bindings, rawCss };
}

module.exports = { compile, compilePageCSS, extractStyles, buildCss };

// CLI 직접 실행 시
if (require.main === module) {
  const pagesDir = path.join(__dirname, 'pages');
  const outDir   = path.join(__dirname, 'public');
  const { cssPath, bindings } = compile(pagesDir, outDir);
  console.log('✅ CSS 생성:', cssPath);
  bindings.forEach(b => console.log(`  .${b.cls}  ←  ${b.name}`));
}
