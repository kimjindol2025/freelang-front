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
 *   helper-load-order — _foo-bar.flx → _foo_bar.flx (부모보다 먼저 정렬될 때)
 *   req-key-collision — body/form "text" · :name "text" → content
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

/** 주석·문자열 바깥의 다음 `(let` (let-xxx 제외). 인덱스 또는 -1. */
function findNextLet(s, from) {
  let i = from;
  while (i < s.length) {
    if (s[i] === ';') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (s.startsWith('#|', i)) {
      const end = s.indexOf('|#', i + 2);
      i = end === -1 ? s.length : end + 2;
      continue;
    }
    if (s[i] === '"') {
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (s.startsWith('"""', i)) {
      i += 3;
      while (i < s.length && !s.startsWith('"""', i)) i++;
      if (s.startsWith('"""', i)) i += 3;
      continue;
    }
    if (s.startsWith('(let', i)) {
      const after = i + 4;
      if (after >= s.length || !/[\w$!?-]/.test(s[after])) return i;
    }
    i++;
  }
  return -1;
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
  // defn/define 이름 · 파라미터 벡터 선두/내부 act (문자열·주석 바깥)
  let src = mapOutsideStrings(code, chunk => {
    return chunk
      .replace(/(\((?:defn|define)\s+)act\b/g, (_, p) => {
        n++;
        return `${p}action`;
      })
      .replace(/(\[\s*)act(\s+)/g, (_, a, b) => {
        n++;
        return `${a}action${b}`;
      });
  });

  // let 바인딩 — 전체 소스에서 브래킷 매칭 (문자열로 끊기면 중간의 act를 놓침)
  function topLevelLetBindings(inner) {
    const names = [];
    let i = 0, phase = true;
    const skipWs = () => { while (i < inner.length && /\s/.test(inner[i])) i++; };
    while (i < inner.length) {
      skipWs();
      if (i >= inner.length) break;
      if (phase) {
        if (!/[a-zA-Z_$]/.test(inner[i])) { i++; continue; }
        let j = i;
        while (j < inner.length && /[\w$!?-]/.test(inner[j])) j++;
        names.push(inner.slice(i, j).replace(/^\$/, ''));
        i = j;
        phase = false;
      } else {
        skipWs();
        if (i >= inner.length) break;
        const ch = inner[i];
        if (ch === '(' || ch === '[' || ch === '{') {
          const open = ch, close = ch === '(' ? ')' : ch === '[' ? ']' : '}';
          let d = 0;
          while (i < inner.length) {
            const c = inner[i];
            if (c === '"') {
              i++;
              while (i < inner.length && inner[i] !== '"') { if (inner[i] === '\\') i++; i++; }
              i++;
              continue;
            }
            if (c === open) d++;
            else if (c === close) { d--; i++; if (d === 0) break; continue; }
            i++;
          }
        } else if (ch === '"') {
          i++;
          while (i < inner.length && inner[i] !== '"') { if (inner[i] === '\\') i++; i++; }
          i++;
        } else {
          while (i < inner.length && !/\s/.test(inner[i])) i++;
        }
        phase = true;
      }
    }
    return names;
  }

  function findMatchingBracket(s, openIdx) {
    let d = 0;
    for (let i = openIdx; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        i++;
        while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; i++; }
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
        while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; i++; }
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

  // 바인딩 이름 act → action (벡터 안 name 자리만)
  function renameActInBindingVector(inner) {
    let i = 0, phase = true, out = '', changed = 0;
    const skipWs = () => {
      const start = i;
      while (i < inner.length && /\s/.test(inner[i])) i++;
      out += inner.slice(start, i);
    };
    while (i < inner.length) {
      skipWs();
      if (i >= inner.length) break;
      if (phase) {
        if (!/[a-zA-Z_$]/.test(inner[i])) { out += inner[i++]; continue; }
        let j = i;
        while (j < inner.length && /[\w$!?-]/.test(inner[j])) j++;
        const name = inner.slice(i, j);
        if (name === 'act' || name === '$act') {
          out += name.startsWith('$') ? '$action' : 'action';
          changed++;
        } else out += name;
        i = j;
        phase = false;
      } else {
        skipWs();
        if (i >= inner.length) break;
        const ch = inner[i];
        if (ch === '(' || ch === '[' || ch === '{') {
          const open = ch, close = ch === '(' ? ')' : ch === '[' ? ']' : '}';
          const start = i;
          let d = 0;
          while (i < inner.length) {
            const c = inner[i];
            if (c === '"') {
              i++;
              while (i < inner.length && inner[i] !== '"') { if (inner[i] === '\\') i++; i++; }
              i++;
              continue;
            }
            if (c === open) d++;
            else if (c === close) { d--; i++; if (d === 0) break; continue; }
            i++;
          }
          out += inner.slice(start, i);
        } else if (ch === '"') {
          const start = i;
          i++;
          while (i < inner.length && inner[i] !== '"') { if (inner[i] === '\\') i++; i++; }
          i++;
          out += inner.slice(start, i);
        } else {
          const start = i;
          while (i < inner.length && !/\s/.test(inner[i])) i++;
          out += inner.slice(start, i);
        }
        phase = true;
      }
    }
    return { inner: out, changed };
  }

  let guard = 0;
  while (guard++ < 50) {
    let found = false;
    let searchFrom = 0;
    while (searchFrom < src.length) {
      const idx = findNextLet(src, searchFrom);
      if (idx === -1) break;
      const afterLet = idx + 4;
      let i = afterLet;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== '[') { searchFrom = afterLet; continue; }
      const closeBr = findMatchingBracket(src, i);
      if (closeBr < 0) { searchFrom = afterLet; continue; }
      const parenEnd = findMatchingParen(src, idx);
      if (parenEnd < 0) { searchFrom = afterLet; continue; }
      const inner = src.slice(i + 1, closeBr);
      const names = topLevelLetBindings(inner);
      if (!names.includes('act')) { searchFrom = afterLet; continue; }
      const { inner: neuInner, changed } = renameActInBindingVector(inner);
      if (!changed) { searchFrom = afterLet; continue; }
      // 본문 식별자 act → action (문자열·주석 바깥)
      let body = src.slice(closeBr + 1, parenEnd);
      body = mapOutsideStrings(body, chunk =>
        chunk.replace(/(^|[^a-zA-Z0-9_$!?-])act(?![a-zA-Z0-9_$!?-])/g, (_, a) => {
          n++;
          return `${a}action`;
        })
      );
      n += changed;
      src = src.slice(0, i + 1) + neuInner + ']' + body + ')' + src.slice(parenEnd + 1);
      found = true;
      break;
    }
    if (!found) break;
  }

  return { code: src, count: n };
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

  // 반복: 한 번에 하나 고쳐 인덱스가 안 꼬이게.
  // 검색은 findNextLet — 주석/문자열 속 (let …) 는 오수정 대상이 아님 (DIAG-COVERAGE-FIX-FP).
  let guard = 0;
  while (guard++ < 200) {
    const letStart = findNextLet(src, 0);
    if (letStart < 0) break;
    const afterLet = letStart + 4;
    let bracketStart = afterLet;
    while (bracketStart < src.length && /\s/.test(src[bracketStart])) bracketStart++;
    if (src[bracketStart] !== '[') {
      src = src.slice(0, letStart) + '(LET_SKIP' + src.slice(letStart + 4);
      continue;
    }
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
      const pat = `(^|[^A-Za-z0-9_\\-!])${old.replace(/!/g, '\\!')}(?![A-Za-z0-9_\\-!])`;
      // 바인딩·본문 치환도 문자열/주석 바깥만 (예제 문자열 속 s/h 보존)
      newBind = mapOutsideStrings(newBind, chunk =>
        chunk.replace(new RegExp(pat, 'g'), (_, p) => {
          n++;
          return `${p}${neu}`;
        })
      );
      newBody = mapOutsideStrings(newBody, chunk =>
        chunk.replace(new RegExp(pat, 'g'), (_, p) => {
          n++;
          return `${p}${neu}`;
        })
      );
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
  const d = fixReqKeyCollision(code);
  if (d.count) {
    code = d.code;
    applied.push({ code: 'req-key-collision', count: d.count });
  }

  if (code !== raw && !dry) fs.writeFileSync(filePath, code, 'utf8');
  return { file: path.relative(__dirname, filePath), applied, changed: code !== raw };
}

/** body/form 키 "text" · :name "text" → content (raw body 충돌)
 *  주의: mapOutsideStrings 는 "…" 내부를 건너뛰므로 이 패턴에는 쓰면 안 됨.
 */
function fixReqKeyCollision(code) {
  let n = 0;
  let next = code.replace(/\(\s*get\s+body\s+"text"\s*\)/g, () => {
    n++;
    return '(get body "content")';
  });
  next = next.replace(/\(\s*form-get\s+req\s+"text"\s*\)/g, () => {
    n++;
    return '(form-get req "content")';
  });
  next = next.replace(/:name\s+"text"/g, () => {
    n++;
    return ':name "content"';
  });
  return { code: next, count: n };
}

/** `_foo-bar.flx` → `_foo_bar.flx` when `_foo.flx` exists and hyphen sorts first */
function fixHelperLoadOrder(dry) {
  const files = fs.readdirSync(PAGES_DIR).filter(f => f.startsWith('_') && f.endsWith('.flx'));
  const set = new Set(files);
  const results = [];
  for (const b of files) {
    const m = /^(_[a-z][a-z0-9]*)-(.+)\.flx$/.exec(b);
    if (!m) continue;
    const parent = `${m[1]}.flx`;
    if (!set.has(parent)) continue;
    if (!(b < parent)) continue;
    const neu = `${m[1]}_${m[2]}.flx`;
    if (set.has(neu)) continue;
    const from = path.join(PAGES_DIR, b);
    const to = path.join(PAGES_DIR, neu);
    if (!dry) fs.renameSync(from, to);
    results.push({
      file: path.relative(__dirname, from),
      applied: [{ code: 'helper-load-order', count: 1, to: neu }],
      changed: true,
    });
  }
  return results;
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
  if (allowed.has('helper-load-order')) {
    results.push(...fixHelperLoadOrder(dry));
  }
  return {
    schema: 'fl-fix/1',
    dry,
    allowed: [...allowed],
    filesChanged: results.length,
    results,
  };
}

module.exports = { runFix, fixJsonParse, fixReservedAct, fixLetShadow, fixHelperLoadOrder, fixReqKeyCollision };

if (require.main === module) {
  const dry = process.argv.includes('--dry') || process.argv.includes('--fix-dry');
  const report = runFix({ dry });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}
