#!/usr/bin/env node
// island-compiler.js — (island Name [] body) → vanilla JS emit

// ── S식 파서 ─────────────────────────────────────────────────
function parse(src) {
  let i = 0;
  function skipWs() {
    while (i < src.length && /[\s,]/.test(src[i])) i++;
    // 라인 주석
    if (src[i] === ';') { while (i < src.length && src[i] !== '\n') i++; skipWs(); }
  }
  function readAtom() {
    let s = '';
    while (i < src.length && !/[\s,(){}[\]"]/.test(src[i])) s += src[i++];
    if (s === 'nil') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (!isNaN(s) && s !== '') return Number(s);
    return { sym: s };
  }
  function readStr() {
    i++; // skip "
    let s = '';
    while (i < src.length && src[i] !== '"') {
      if (src[i] === '\\') { i++; s += src[i++]; } else s += src[i++];
    }
    i++; // skip "
    return s;
  }
  function readList(close) {
    i++; // skip open
    const items = [];
    skipWs();
    while (i < src.length && src[i] !== close) {
      items.push(read());
      skipWs();
    }
    i++; // skip close
    return items;
  }
  function read() {
    skipWs();
    if (i >= src.length) return null;
    const c = src[i];
    if (c === '(') return readList(')');
    if (c === '[') return readList(']');
    if (c === '{') {
      const pairs = readList('}');
      const obj = {};
      for (let j = 0; j < pairs.length; j += 2) {
        const k = pairs[j];
        // :keyword → "keyword", symbol → sym, string → string
        obj[typeof k === 'string' ? k : k?.kw ?? k?.sym ?? String(k)] = pairs[j + 1];
      }
      return { map: obj };
    }
    if (c === '"') return readStr();
    if (c === '@') { i++; return [{ sym: 'deref' }, read()]; }
    if (c === ':') { i++; return { kw: readAtom().sym }; }
    return readAtom();
  }
  return read();
}

// ── FL AST → JS 코드 생성 ────────────────────────────────────
function emit(node, ctx = { needsUpdate: false }) {
  if (node === null) return 'null';
  if (node === true) return 'true';
  if (node === false) return 'false';
  if (typeof node === 'number') return String(node);
  if (typeof node === 'string') return JSON.stringify(node);
  if (Array.isArray(node)) return emitList(node, ctx);   // 배열 먼저 — node?.map은 Array.prototype.map과 충돌
  if (node?.kw)  return JSON.stringify(node.kw);
  if (node?.sym) return emitSym(node.sym);
  if (node?.map) return emitMap(node.map, ctx);
  return 'null';
}

const SYM_MAP = {
  'inc':   'v => v + 1',
  'dec':   'v => v - 1',
  'not':   'v => !v',
  'str':   '_fl_str',
  'nil?':  'v => v == null',
  'empty?':'v => !v || v.length === 0',
};
function emitSym(s) {
  if (SYM_MAP[s]) return SYM_MAP[s];
  return s.replace(/-/g, '_').replace(/\?$/, '_q').replace(/!$/, '_bang');
}

function emitMap(obj, ctx) {
  const pairs = Object.entries(obj).map(([k, v]) => {
    const kStr = k.startsWith(':') ? JSON.stringify(k.slice(1)) : JSON.stringify(k);
    return `${kStr}: ${emit(v, ctx)}`;
  });
  return `{${pairs.join(', ')}}`;
}

function emitList(node, ctx) {
  if (!node.length) return '[]';
  const head = node[0];
  const args = node.slice(1);

  if (head?.sym === 'island') return emitIsland(args, ctx);
  if (head?.sym === 'let')    return emitLet(args, ctx);
  if (head?.sym === 'fn')     return emitFn(args, ctx);
  if (head?.sym === 'if')     return emitIf(args, ctx);
  if (head?.sym === 'do')     return emitDo(args, ctx);
  if (head?.sym === 'atom')   return `_fl.atom(${emit(args[0], ctx)})`;
  if (head?.sym === 'deref')  return `_fl.deref(${emit(args[0], ctx)})`;
  if (head?.sym === 'swap!')  return emitSwap(args, ctx);
  if (head?.sym === 'reset!') return emitReset(args, ctx);
  if (head?.sym === 'h')      return emitH(args, ctx);
  if (head?.sym === 'str')    return emitStr(args, ctx);
  if (head?.sym === '+')      return `(${args.map(a=>emit(a,ctx)).join(' + ')})`;
  if (head?.sym === '-')      return `(${args.map(a=>emit(a,ctx)).join(' - ')})`;
  if (head?.sym === '*')      return `(${args.map(a=>emit(a,ctx)).join(' * ')})`;
  if (head?.sym === '/')      return `(${args.map(a=>emit(a,ctx)).join(' / ')})`;
  if (head?.sym === '=')      return `(${emit(args[0],ctx)} === ${emit(args[1],ctx)})`;
  if (head?.sym === 'not')    return `!(${emit(args[0],ctx)})`;
  if (head?.sym === 'when')   return `(${emit(args[0],ctx)}) ? (${emit(args[1],ctx)}) : null`;
  // 일반 함수 호출
  const fn = emit(head, ctx);
  return `${fn}(${args.map(a => emit(a, ctx)).join(', ')})`;
}

function emitIsland(args, ctx) {
  // (island Name [] body)
  const body = args.slice(2);
  const bodyJs = body.map(n => emit(n, ctx)).join(';\n    ');
  return `(update) => {\n    return ${bodyJs};\n  }`;
}

function emitLet(args, ctx) {
  // (let [x expr y expr] body...)
  const bindings = args[0]; // array
  const body = args.slice(1);
  const decls = [];
  for (let i = 0; i < bindings.length; i += 2) {
    const name = emitSym(bindings[i]?.sym ?? String(bindings[i]));
    const val  = emit(bindings[i + 1], ctx);
    decls.push(`const ${name} = ${val}`);
  }
  const bodyJs = body.map(n => emit(n, ctx)).join(';\n  ');
  return `(() => { ${decls.join('; ')}; return ${bodyJs}; })()`;
}

function emitFn(args, ctx) {
  const params = args[0].map(p => emitSym(p?.sym ?? String(p)));
  const body   = args.slice(1);
  const bodyJs = body.map((n, i) =>
    i === body.length - 1 ? `return ${emit(n, ctx)}` : emit(n, ctx)
  ).join('; ');
  return `(${params.join(', ')}) => { ${bodyJs}; }`;
}

function emitIf(args, ctx) {
  return `(${emit(args[0],ctx)}) ? (${emit(args[1],ctx)}) : (${emit(args[2]??null,ctx)})`;
}

function emitDo(args, ctx) {
  return `(() => { ${args.map(a=>emit(a,ctx)).join('; ')} })()`;
}

function emitSwap(args, ctx) {
  // (swap! atom fn) → (_fl.swap(atom, fn), update())
  return `(_fl.swap(${emit(args[0],ctx)}, ${emit(args[1],ctx)}), update())`;
}

function emitReset(args, ctx) {
  return `(_fl.reset(${emit(args[0],ctx)}, ${emit(args[1],ctx)}), update())`;
}

function emitH(args, ctx) {
  // (h "tag" {attrs} children...)
  const tag    = emit(args[0], ctx);
  const attrs  = args[1] ? emit(args[1], ctx) : '{}';
  const children = args.slice(2).map(a => emit(a, ctx));
  return `_fl.h(${tag}, ${attrs}${children.length ? ', ' + children.join(', ') : ''})`;
}

function emitStr(args, ctx) {
  return `[${args.map(a => emit(a, ctx)).join(', ')}].map(String).join('')`;
}

// ── Island 런타임 (minified, ~500B) ─────────────────────────
const FL_ISLAND_RT = `<script>
const _fl={
  atom:(v)=>({v}),
  deref:(a)=>a.v,
  swap:(a,f)=>{a.v=f(a.v);return a.v;},
  reset:(a,v)=>{a.v=v;return v;},
  h:(tag,attrs,...ch)=>{
    const el=document.createElement(tag);
    for(const[k,v]of Object.entries(attrs||{})){
      if(k.startsWith('on-'))el.addEventListener(k.slice(3),v);
      else el.setAttribute(k,String(v));
    }
    ch.flat().forEach(c=>el.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(String(c)):c));
    return el;
  },
  mount:(id,renderFn)=>{
    const el=document.getElementById(id);
    if(!el)return;
    const update=()=>{while(el.firstChild)el.removeChild(el.firstChild);el.appendChild(renderFn(update));};
    update();
  }
};
const _fl_str=(...xs)=>xs.map(String).join('');
</script>`;

// ── .flx 파일에서 (island ...) 블록 추출 ────────────────────
function extractIslands(content) {
  const islands = [];
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf('(island ', i);
    if (idx === -1) break;
    let depth = 0, j = idx;
    while (j < content.length) {
      if (content[j] === '(') depth++;
      else if (content[j] === ')') { depth--; if (depth === 0) { j++; break; } }
      j++;
    }
    const block = content.slice(idx, j);
    islands.push({ block, start: idx, end: j });
    i = j;
  }
  return islands;
}

// ── 파일 내 island 컴파일 ────────────────────────────────────
// 반환: { html: 수정된 HTML 스니펫, scripts: [JS 코드], hasIslands }
function compileFileIslands(flxContent) {
  const found = extractIslands(flxContent);
  if (!found.length) return { flxContent, scripts: [], hasIslands: false };

  const scripts = [];
  let modified  = flxContent;
  let offset    = 0;

  found.forEach(({ block, start, end }, idx) => {
    const ast  = parse(block);
    const name = ast[1]?.sym ?? `Island${idx}`;
    const id   = `island-${name.toLowerCase()}-${idx}`;
    const renderFn = emitIsland(ast.slice(1), {});
    const js   = `_fl.mount(${JSON.stringify(id)}, ${renderFn});`;
    scripts.push(js);
    // island 블록 → <div id="..."></div> 플레이스홀더로 교체
    const placeholder = `"<div id='${id}'></div>"`;
    modified = modified.slice(0, start + offset) + placeholder + modified.slice(end + offset);
    offset += placeholder.length - (end - start);
  });

  return { flxContent: modified, scripts, hasIslands: true };
}

module.exports = { compileFileIslands, FL_ISLAND_RT, extractIslands };

// CLI 테스트
if (require.main === module) {
  const testFlx = `
(island Counter []
  (let [n (atom 0)]
    (h "button" {:on-click (fn [] (swap! n inc))} (str @n))))
`;
  const { flxContent, scripts } = compileFileIslands(testFlx);
  const rt = FL_ISLAND_RT.replace(/<\/?script>/g, '');
  const total = Buffer.byteLength(rt + scripts.join('\n'), 'utf8');
  console.log('placeholder:', flxContent.trim());
  console.log('JS:');
  console.log(scripts.join('\n'));
  console.log(`총 크기: ${total}B (${total < 2048 ? '✅ < 2KB' : '❌ >= 2KB'})`);
}
