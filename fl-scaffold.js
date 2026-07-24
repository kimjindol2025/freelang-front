#!/usr/bin/env node
/**
 * fl-scaffold.js — afl-db coll 앱 스캐폴드 (콜드스타트 계약 실행형)
 *
 *   node fl-scaffold.js --ns clips --fields text
 *   node fl-scaffold.js --ns clips --fields text,title --dry
 *   node fl-scaffold.js --ns clips --fields text --name clips   # 폴더명 (기본=ns)
 *
 * 생성: pages/<name>/{_db,api,index}.flx + afldb_coll_namespaces append
 * TRAPS 회피: json_parse 미사용, act/let[s] 없음, _부모-자식 헬퍼 없음, 주석에 (defn 없음
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PAGES = path.join(ROOT, 'pages');
const COLL = path.join(PAGES, '_afldb_coll.flx');

function parseArgs(argv) {
  const out = { ns: null, fields: ['text'], name: null, dry: false, title: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') out.dry = true;
    else if (a === '--ns') out.ns = argv[++i];
    else if (a === '--fields') out.fields = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--title') out.title = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (!out.name) out.name = out.ns;
  if (!out.title && out.ns) out.title = out.ns.charAt(0).toUpperCase() + out.ns.slice(1);
  return out;
}

function assertIdent(s, label) {
  if (!/^[a-z][a-z0-9_]*$/.test(s)) {
    throw new Error(`${label} must be lowercase snake/ident: got '${s}'`);
  }
}

/** req body / form 과 충돌하는 필드명 — TRAPS·실측 */
const BLOCKED_FIELDS = new Set(['text', 'body', 'action', 'id', 'ok', 'items', 'status']);

function assertField(s) {
  assertIdent(s, 'field');
  if (BLOCKED_FIELDS.has(s)) {
    throw new Error(`field '${s}' blocked (req body collision) — use content/title/…`);
  }
}

function loadNamespaces(src) {
  const m = src.match(/\(define\s+afldb_coll_namespaces\s+(\[[^\]]*\])\)/);
  if (!m) throw new Error('afldb_coll_namespaces define not found');
  const raw = m[1];
  const names = [...raw.matchAll(/"([^"]+)"/g)].map(x => x[1]);
  return { names, raw, full: m[0] };
}

function genDb(ns, fields) {
  const nsVar = `${ns}_ns`;
  const fieldPuts = fields.map(f => `"${f}" ${f}`).join(' ');
  const addParams = fields.join(' ');
  return `; pages/${ns}/_db.flx — scaffold (afldb-coll thin)
; ns: ${ns} · fields: ${fields.join(', ')}

(define ${nsVar} "${ns}")

(defn ${ns}-all []
  (afldb-coll-all ${nsVar}))

(defn ${ns}-add [${addParams}]
  (afldb-coll-create ${nsVar} {${fieldPuts}}))

(defn ${ns}-delete [id]
  (afldb-coll-delete ${nsVar} id))

(defn ${ns}-history [id]
  (afldb-coll-history ${nsVar} id))
`;
}

function genApi(ns, fields) {
  const nsVar = `${ns}_ns`;
  const binds = fields.map(f =>
    `${f} (str-trim (str (or (get body "${f}") "")))`
  ).join('\n            ');
  const emptyCheck = fields.length === 1
    ? `(= ${fields[0]} "")`
    : `(or ${fields.map(f => `(= ${f} "")`).join(' ')})`;
  const errFields = fields.join('·');
  const addArgs = fields.join(' ');
  return `; pages/${ns}/api.flx — GET list / POST add|delete|history

(load "pages/${ns}/_db.flx")

(defn render [req]
  (server-json {"ok" true
                "backend" "afl-db"
                "coll" ${nsVar}
                "items" (${ns}-all)
                "status" (afldb-status)}))

(defn render_post [req]
  (let [body (get req "body")
        action (str (or (get body "action") ""))]
    (cond
      (= action "add")
      (let [${binds}]
        (if ${emptyCheck}
          (server-json {"ok" false "error" "${errFields} 필요"})
          (do
            (${ns}-add ${addArgs})
            (server-json {"ok" true "items" (${ns}-all)}))))

      (= action "delete")
      (let [id (str (get body "id"))]
        (${ns}-delete id)
        (server-json {"ok" true "items" (${ns}-all)}))

      (= action "history")
      (let [id (str (get body "id"))]
        (server-json {"ok" true "id" id "events" (${ns}-history id)}))

      true
      (server-json {"ok" false "error" "unknown action — add|delete|history"}))))
`;
}

function genIndex(ns, fields, title) {
  const fieldGets = fields.map(f =>
    `        ${f} (str (or (get it "${f}") ""))`
  ).join('\n');
  const fieldSpans = fields.map(f =>
    `      (h "span" {} (str " " ${f}))`
  ).join('\n');
  const inputs = fields.map(f =>
    `          (h! "input" {:type "text" :name "${f}" :placeholder "${f}"})`
  ).join('\n');
  return `; pages/${ns}/index.flx — list + add + delete SSR form

(load "pages/${ns}/_db.flx")

(defn ${ns}-row [it]
  (let [id (str (get it "id"))
${fieldGets}]
    (h "li" {}
${fieldSpans}
      (h "form" {:method "POST" :action "/${ns}/api" :style "display:inline"}
        (h! "input" {:type "hidden" :name "action" :value "delete"})
        (h! "input" {:type "hidden" :name "id" :value id})
        (h! "button" {:type "submit"} "del")))))

(defn render [req]
  (let [items (${ns}-all)]
    (layout-html "${title}"
      (h "div" {:style "max-width:40rem;margin:2rem auto;font-family:sans-serif"}
        (h "h1" {} "${title}")
        (h "p" {} "afl-db coll scaffold")
        (h "form" {:method "POST" :action "/${ns}/api"}
          (h! "input" {:type "hidden" :name "action" :value "add"})
${inputs}
          (h! "button" {:type "submit"} "add"))
        (h "ul" {}
          (arr-join (map ${ns}-row items) "")))
      req)))
`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.ns) {
    process.stdout.write(`Usage: node fl-scaffold.js --ns <ns> [--fields a,b] [--name dir] [--title Title] [--dry]\n`);
    process.exit(args.help ? 0 : 1);
  }
  assertIdent(args.ns, 'ns');
  assertIdent(args.name, 'name');
  for (const f of args.fields) assertField(f);

  const dir = path.join(PAGES, args.name);
  const files = {
    [path.join(dir, '_db.flx')]: genDb(args.ns, args.fields),
    [path.join(dir, 'api.flx')]: genApi(args.ns, args.fields),
    [path.join(dir, 'index.flx')]: genIndex(args.ns, args.fields, args.title),
  };

  const collSrc = fs.readFileSync(COLL, 'utf8');
  const { names, full } = loadNamespaces(collSrc);
  if (names.includes(args.ns)) {
    process.stderr.write(`ns '${args.ns}' already in afldb_coll_namespaces\n`);
  }
  const newNames = names.includes(args.ns) ? names : [...names, args.ns];
  const newDefine = `(define afldb_coll_namespaces [${newNames.map(n => `"${n}"`).join(' ')}])`;
  const planned = [
    ...Object.keys(files).map(f => path.relative(ROOT, f)),
    path.relative(ROOT, COLL) + (names.includes(args.ns) ? ' (ns already present)' : ` (append "${args.ns}")`),
  ];

  if (args.dry) {
    process.stdout.write(JSON.stringify({
      schema: 'fl-scaffold/1',
      dry: true,
      ns: args.ns,
      name: args.name,
      fields: args.fields,
      planned,
    }, null, 2) + '\n');
    return;
  }

  if (fs.existsSync(dir)) {
    throw new Error(`directory exists: ${dir}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const [fp, body] of Object.entries(files)) {
    fs.writeFileSync(fp, body, 'utf8');
  }
  if (!names.includes(args.ns)) {
    fs.writeFileSync(COLL, collSrc.replace(full, newDefine), 'utf8');
  }

  process.stdout.write(JSON.stringify({
    schema: 'fl-scaffold/1',
    dry: false,
    ns: args.ns,
    name: args.name,
    fields: args.fields,
    written: planned,
  }, null, 2) + '\n');
}

try {
  main();
} catch (e) {
  process.stderr.write(String(e.message || e) + '\n');
  process.exit(1);
}
