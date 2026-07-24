#!/usr/bin/env node
/**
 * fl-front-fix.js — P6 안전 자동수정 (machine-applicable only)
 *
 *   node fl-front-fix.js           # 적용
 *   node fl-front-fix.js --dry     # 미리보기만
 *   node fl-front-build.js --fix    # fix 후 빌드
 *   node fl-front-build.js --fix-dry
 *
 * 허용 코드 (fl-diagnostic-codes.js applicability=machine-applicable):
 *   json-parse-hyphen — (json-parse → (json_parse
 *   reserved-word     — 식별자 act → action (defn/define/파라미터/let)
 *   let-shadow        — let 바인딩 s/h/h! → sess/html-el/h-bang + 본문 식별자
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { machineApplicable } = require('./fl-diagnostic-codes');

const PAGES_DIR = path.join(__dirname, 'pages');

const LET_RENAME = { s: 'sess', h: 'html-el', 'h!': 'h-bang' };
const RESERVED_RENAME = { act: 'action' };

function walkFlx(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFlx(p, out);
    else if (ent.name.endsWith('.flx')) out.push(p);
  }
  return out;
}

/** 문자열/주석 바깥에서만 치환 — 단순 상태기계 */
function mapOutsideStrings(src, mapper) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | str
  while (i < src.length) {
    if (state === 'code') {
      if (src[i] === ';' && (i === 0 || src[i - 1] !== '\\')) {
        // line comment
        const end = src.indexOf('\n', i);
        const chunk = end === -1 ? src.slice(i) : src.slice(i, end + 1);
        out += chunk;
        i += chunk.length;
        continue;
      }
      if (src.startsWith('#|', i)) {
        const end = src.indexOf('|#', i + 2);
        const chunk = end === -1 ? src.slice(i) : src.slice(i, end + 2);
        out += chunk;
        i += chunk.length;
        continue;
      }
      if (src[i] === '"') {
        state = 'str';
        out += src[i++];
        continue;
      }
      // code run until next special
      let j = i;
      while (j < src.length) {
        if (src[j] === '"' || src[j] === ';' || src.startsWith('#|', j)) break;
        j++;
      }
      out += mapper(src.slice(i, j));
      i = j;
      continue;
    }
    if (state === 'str') {
      if (src[i] === '\\' && i + 1 < src.length) {
        out += src[i] + src[i + 1];
        i += 2;
        continue;
      }
      if (src[i] === '"') {
        out += src[i++];
        state = 'code';
        continue;
      }
      out += src[i++];
    }
  }
  return out;
}

function fixJsonParse(code) {
  let n = 0;
  const next = mapOutsideStrings(code, chunk =>
    chunk.replace(/\(json-parse\b/g, () => {
      n++;
      return '(json_parse';
    })
  );
  return { code: next, count: n };
}

function fixReservedAct(code) {
  let n = 0;
  const next = mapOutsideStrings(code, chunk => {
    // (defn act …) (define act …) 파라미터/let 바인딩 토큰 act
    return chunk
      .replace(/(\((?:defn|define)\s+)act\b/g, (_, p) => {
        n++;
        return `${p}action`;
      })
      .replace(/(\[\s*)act(\s+)/g, (_, a, b) => {
        n++;
        return `${a}action${b}`;
      })
      .replace(/(\[\s*[^\]]*?\s)act(\s+)/g, (m, a, b) => {
        // 바인딩 벡터 중간 — 과도한 매칭 위험 있어 위에서 1차만; 여기 보조
        if (/\bact\b/.test(m)) {
          n++;
          return `${a}action${b}`;
        }
        return m;
      });
  });
  return { code: next, count: n };
}

/**
 * let [ … ] 에서 denylist 바인딩 rename + 해당 let 본문 식별자 rename
 * 중첩 let은 바깥부터 한 패스 (보수적).
 */
function fixLetShadow(code) {
  let n = 0;
  let src = code;

  function findLetBindingEnd(s, openBracketIdx) {
    // openBracketIdx points at '['
    let d = 0;
    for (let i = openBracketIdx; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        i++;
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') i++;
          i++;
        }
        continue;
      }
      if (c === '[') d++;
      else if (c === ']') {
        d--;
        if (d === 0) return i;
      }
    }
    return -1;
  }

  function findMatchingParen(s, openParenIdx) {
    let d = 0;
    for (let i = openParenIdx; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        i++;
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') i++;
          i++;
        }
        continue;
      }
      if (c === '(') d++;
      else if (c === ')') {
        d--;
        if (d === 0) return i;
      }
    }
    return -1;
  }

  // 반복: 한 번에 하나 고쳐 인덱스가 안 꼬이게
  let guard = 0;
  while (guard++ < 200) {
    const m = /\(let\s+\[/.exec(src);
    if (!m) break;
    const letStart = m.index;
    const bracketStart = src.indexOf('[', letStart);
    const bracketEnd = findLetBindingEnd(src, bracketStart);
    if (bracketEnd < 0) break;
    const parenEnd = findMatchingParen(src, letStart);
    if (parenEnd < 0) break;

    const bindVec = src.slice(bracketStart + 1, bracketEnd);
    const body = src.slice(bracketEnd + 1, parenEnd);

    // top-level binding names in vector (reuse simple scanner)
    const names = [];
    {
      let i = 0;
      let phase = true; // expecting name
      while (i < bindVec.length) {
        while (i < bindVec.length && /\s/.test(bindVec[i])) i++;
        if (i >= bindVec.length) break;
        if (phase) {
          let j = i;
          while (j < bindVec.length && !/\s/.test(bindVec[j]) && bindVec[j] !== '[' && bindVec[j] !== '(') j++;
          const name = bindVec.slice(i, j);
          if (name && LET_RENAME[name]) names.push(name);
          i = j;
          phase = false;
        } else {
          const ch = bindVec[i];
          if (ch === '(' || ch === '[') {
            const open = ch;
            const close = ch === '(' ? ')' : ']';
            let d = 0;
            while (i < bindVec.length) {
              const c = bindVec[i];
              if (c === '"') {
                i++;
                while (i < bindVec.length && bindVec[i] !== '"') {
                  if (bindVec[i] === '\\') i++;
                  i++;
                }
                i++;
                continue;
              }
              if (c === open) d++;
              else if (c === close) {
                d--;
                i++;
                if (d === 0) break;
                continue;
              }
              i++;
            }
          } else if (ch === '"') {
            i++;
            while (i < bindVec.length && bindVec[i] !== '"') {
              if (bindVec[i] === '\\') i++;
              i++;
            }
            i++;
          } else {
            while (i < bindVec.length && !/\s/.test(bindVec[i])) i++;
          }
          phase = true;
        }
      }
    }

    if (names.length === 0) {
      // skip this let — mark by replacing with a no-op sentinel? advance search
      // replace `(let` temporarily to skip — restore later via unique marker
      src = src.slice(0, letStart) + '(LET_SKIP' + src.slice(letStart + 4);
      continue;
    }

    let newBind = bindVec;
    let newBody = body;
    for (const old of names) {
      const neu = LET_RENAME[old];
      const re = new RegExp(
        `(^|[^A-Za-z0-9_\\-!])${old.replace(/!/g, '\\!')}(?![A-Za-z0-9_\\-!])`,
        'g'
      );
      newBind = newBind.replace(re, (_, p) => {
        n++;
        return `${p}${neu}`;
      });
      newBody = newBody.replace(re, (_, p) => {
        n++;
        return `${p}${neu}`;
      });
    }

    src =
      src.slice(0, bracketStart + 1) +
      newBind +
      ']' +
      newBody +
      ')' +
      src.slice(parenEnd + 1);
    // 방금 고친 let은 다시 매칭되지 않게
    src = src.slice(0, letStart) + '(LET_DONE' + src.slice(letStart + 4);
  }

  src = src.replace(/\(LET_SKIP/g, '(let').replace(/\(LET_DONE/g, '(let');
  return { code: src, count: n };
}

function fixFile(filePath, dry) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let code = raw;
  const applied = [];

  const a = fixJsonParse(code);
  if (a.count) {
    code = a.code;
    applied.push({ code: 'json-parse-hyphen', count: a.count });
  }
  const b = fixReservedAct(code);
  if (b.count) {
    code = b.code;
    applied.push({ code: 'reserved-word', count: b.count });
  }
  const c = fixLetShadow(code);
  if (c.count) {
    code = c.code;
    applied.push({ code: 'let-shadow', count: c.count });
  }

  if (code !== raw && !dry) fs.writeFileSync(filePath, code, 'utf8');
  return { file: path.relative(__dirname, filePath), applied, changed: code !== raw };
}

function runFix(opts = {}) {
  const dry = !!opts.dry;
  const allowed = new Set(machineApplicable().map(c => c.code));
  const files = walkFlx(PAGES_DIR);
  const results = [];
  for (const f of files) {
    const r = fixFile(f, dry);
    if (r.changed) results.push(r);
  }
  return {
    schema: 'fl-fix/1',
    dry,
    allowed: [...allowed],
    filesChanged: results.length,
    results,
  };
}

module.exports = { runFix, fixJsonParse, fixReservedAct, fixLetShadow };

if (require.main === module) {
  const dry = process.argv.includes('--dry') || process.argv.includes('--fix-dry');
  const report = runFix({ dry });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}
