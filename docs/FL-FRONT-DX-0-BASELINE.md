# FL-FRONT-DX-0 Baseline

Date: 2026-09-04
Scope: Front syntax, diagnostics, compatibility boundaries. No Front source, generated artifact, process, or remote was changed by this investigation; this baseline document is the sole committed artifact.

## Status

`STATUS=PASS`
`PROJECT_STATUS=FL_FRONT_DX0_BASELINE_COMPLETE`

The requested implementation paths and the three representative compile paths below were verified. This does **not** assert that the inactive `:40860` service was started or browser-tested; runtime operation was explicitly outside this DX-0 scope.

## Preservation baseline

The Front worktree had exactly two pre-existing modified files before this work.

| File | Pre-DX-0 SHA256 | Observed change character | Collision risk |
| --- | --- | --- | --- |
| `.build-state.json` | `7f0fddadfe944ac6ebac3a1eef554a139785354353a7eb8f2ccafe56f6510b08` | Generated build report: timestamp, repository HEAD, FL bootstrap path, and one `fl-http-allow` warning differ. Diffstat contribution: 15 insertions / 33 deletions. | **High**: `fl-front-build.js` rewrites this file at build end. No full build was run. |
| `fl-front-init.js` | `a18fa28634b7e1f2b20075e45c2a703b918c62e908e79a454cd39cee5e8acfe7` | Scaffold portability/runtime changes: `path.resolve`, copied bundled runtime and tools, and generated scripts that include `PORT` and `FL_HTTP_ALLOW`. Diffstat contribution: 13 insertions / 10 deletions. | **Low for a Front build**, but this is user source and was not touched. |

Initial commands and result:

```text
git status --short       -> M .build-state.json; M fl-front-init.js
git diff --name-only     -> .build-state.json; fl-front-init.js
git diff --stat          -> 2 files changed, 28 insertions(+), 43 deletions(-)
```

The full builder also has write paths for `_app.fl`, `AGENTS.md`, `.build-cache.json`, `.build-state.json`, and `public/app.css` (`fl-front-build.js`: `generate`, `saveCache`, `styleCompiler.compile`, and final build-state write). Therefore it was deliberately not invoked. `server.fl` is the stable launcher that loads `_app.fl`; it is not written by this builder.

## Current processing flow

```
pages/**/*.flx
  │
  ├─ Front build scan: scanPages / scanHelpers
  ├─ Front source rewrites: server-fn, style, defstore, load/ns
  ├─ SSR/API: source remains FreeLang forms
  │      └─ generated _app.fl
  │             └─ server.fl loads _app.fl
  │                    └─ runtime/bootstrap.js
  │                          lex → parse → FreeLang AST → Interpreter
  │
  └─ Island: extractIslands
         └─ island-compiler parse (private JS AST)
               └─ emit / emitIsland / emitH / emitMap
                     └─ inline browser JS + FL_ISLAND_RT in _app.fl
```

There are consequently two parsers in the Front execution path:

1. SSR/API uses the bundled canonical FreeLang runtime in `runtime/bootstrap.js`. It contains the generated copies of `platform/freelang-afj/src/lexer.ts`, `parser.ts`, `ast.ts`, `interpreter.ts`, and `codegen-js.ts`.
2. Island uses the deliberately smaller, independent parser in `island-compiler.js`. Its AST is plain JavaScript values: strings/numbers/booleans, `{sym}`, `{kw}`, `{map}`, and nested arrays. It is not the canonical FreeLang AST.

This split is the primary DX compatibility boundary: a surface feature accepted by the runtime parser is not automatically accepted by Island, and a Front source rewrite can bypass both ASTs.

## Implementation map

| Capability | Actual implementation path | Key functions / evidence |
| --- | --- | --- |
| Tokenization | `runtime/bootstrap.js` (bundled `src/lexer.ts`); source of record `../freelang-afj/src/lexer.ts` | `lex(source)`; preserves token `line` and `col`, strings, triple-quoted strings, comments, delimiters, symbols, variables, and keywords. |
| Parenthesis / collection parsing | `runtime/bootstrap.js` (bundled `src/parser.ts`); source `../freelang-afj/src/parser.ts` | `parse(tokens)`, `Parser.parse`, `parseSExpr`, `parseArray`, `parseMap`; `ParserError` carries line, column, code, hint, and stage. |
| Canonical AST | `../freelang-afj/src/ast.ts`, bundled into `runtime/bootstrap.js` | `makeLiteral`, `makeVariable`, `makeSExpr`, `makeBlock`, `makeModuleBlock`, `makeImportBlock`, `makeOpenBlock`; AST nodes use `kind`, and blocks retain `fields: Map`. |
| SSR/API assembly | `fl-front-build.js` | `scanPages`, `scanHelpers`, `generate`, `fileToRoute`, `routeToFnName`; `render`/`render_post` are renamed and wrapped, then registered with `server-get` / `server-post`. |
| SSR `h`, `str`, layout | `fl-front-build.js` injected helper string and `pages/_layout.flx` | `INJECTED_HELPERS` defines fixed-arity `h [tag attrs content]`, `h!`, `arr-join`, and the `server-html` alias. `layout-html` is defined in `pages/_layout.flx`; ordinary `h`, `str`, and `layout-html` forms are passed through to `_app.fl`, not compiled by a Front AST pass. |
| Island parser and JS generation | `island-compiler.js` | `parse`, `read`, `readAtom`, `emit`, `emitList`, `emitIsland`, `emitLet`, `emitH`, `emitMap`, `emitGetIn`, `compileFileIslands`, `extractIslands`, and `FL_ISLAND_RT`. |
| Map and string-key access | SSR: canonical parser/interpreter. Island: `island-compiler.js` | Island `emitMap` converts keys to JS string keys; `(get obj key)` emits `_fl.get`, and `emitGetIn` emits optional JS index chaining. The current portable source form is `(get row "severity")`, not `row.severity`. |
| Diagnostics / source locations | `fl-front-build.js`, `fl-diagnostic-codes.js`, bundled `runtime/bootstrap.js` | Builder `issue`, `checkAllParens`, `validateFunctions`, `validateIslandJs`, `validateIslandBoundary`, `toDiagnostics`; code catalog `DIAGNOSTIC_CODES`; runtime `ParserError`, `checkSource`, `formatError`, `typeCheckSource`. |
| `load` and namespace handling | `fl-front-build.js`; core alternative in `../freelang-afj/src/*` | Front `resolveLoad` regex-inlines one resolved file per build, while `applyNs` regex-prefixes `(defn ...)` and call sites. Core parser has `parseImportExpression`/`parseOpenExpression`; AST has module/import/open blocks; interpreter delegates to `eval-module-system.ts`. Current Front `.flx` uses `load` + `ns`, not that core module system. |
| Builder outputs | `fl-front-build.js`, `style-compiler.js` | `OUT_FILE = _app.fl`; `AGENTS_FILE = AGENTS.md`; `saveCache` writes `.build-cache.json`; final state writes `.build-state.json`; `styleCompiler.compile(pagesDir, public)` writes `public/app.css`. |

## Existing syntax-to-output correspondence

| Source form | Current lowering / generated result | Compatibility implication |
| --- | --- | --- |
| `(defn render [req] ...)` | `generate` renames it to `page_*__inner`, emits a `try` wrapper, then `server-get` registration. | Keep this convention; route behavior is builder-owned. |
| `(defn render_post [req] ...)` | Same renaming/wrapping, plus `server-post`. | API/form POST remains compatible without new runtime syntax. |
| `(h "div" {:class card} content)` | SSR: injected FreeLang `h` emits an HTML string. Island: `emitH` emits `_fl.h(tag, attrs, ...children)`. | SSR currently has one `content` parameter; Island already supports multiple children. |
| `(str a b)` | Remains a FreeLang call in SSR; Island `emitStr` emits `_fl_str(a, b)`. | Safe common denominator. |
| `(layout-html title content req)` | Defined in `pages/_layout.flx`, remains an SSR FreeLang call. | Not a dedicated Front AST node. |
| `(island Name [] body)` plus placeholders | Builder removes the form from server source, compiles it, replaces `ISLAND_PLACEHOLDER` and `ISLAND_SCRIPTS`, and injects `FL_ISLAND_RT`. | Island feature work must update its parser/emitter/runtime as appropriate. |
| `{:k v}` and `(get row "k")` | Canonical AST produces a `Map` block; Island map AST emits a JS object and `get` emits `_fl.get`. | This is the stable cross-layer field-access form. |
| `(load "pages/x/_db.flx")` | `resolveLoad` inlines the resolved file once; `ns` is textual prefixing. | Import visibility and cycles are not currently enforced semantics. |

## Representative individual compile evidence

All commands were run in `platform/freelang-front`; temporary JS was created below a unique `/tmp/fl-front-dx0.*` directory, syntax-checked, and removed. No repository output path was used.

| Layer | Representative file | Command path | Result |
| --- | --- | --- | --- |
| SSR | `pages/examples/01-hello.flx` | `runtime/bootstrap.js compile … -o /tmp/.../ssr.js`, then `node --check` | PASS. Compiler reported `✓ 컴파일 완료`; JS SHA256 was `819b15eaf9094d0071a806d7afec4cf5c2d14524e82d635826fa7a52ba423782`. |
| API | `pages/examples/26-json-api.flx` | `runtime/bootstrap.js compile … -o /tmp/.../api.js`, then `node --check` | PASS. Compiler reported `✓ 컴파일 완료`; JS SHA256 was `3920f0f26d62dde99872abedd2b10ee1a95433b58ee7b4579bf8b6a94104838e`. |
| Island | `pages/examples/31-island-patterns.flx` | `extractIslands` → `compileFileIslands` → write temporary JS → `node --check` | PASS. Exactly one Island and one script were emitted; JS SHA256 was `d8bf0bef14e5bf617ef70ef254d393b68f8158d577081ffad9fa711793c51364`. |

The runtime `check` command also reported syntactic and static-type success for the SSR/API examples, with non-fatal metadata warnings that `render` lacks `:context` / `:returns`.

Investigation finding: `runtime/bootstrap.js compile <file>` without `-o` currently rejects its only positional input because `cmdCompile` computes `outputIdx = -1` and excludes `args3[0]`. Supplying `-o` uses the same compiler and succeeds. This is a CLI DX defect, not a representative-source failure; it should be a separate, narrow regression task.

## DX classification and lowering plan

Each classification states the earliest layer that must change to provide the feature safely in both SSR/API and Island.

| Improvement | Classification | Can lower to current representation? | Basis / required boundary |
| --- | --- | --- | --- |
| 1. Formatter and parenthesis diagnostics | `STATIC_ANALYSIS` | Yes. Token positions plus builder `checkAllParens`/`issue` are sufficient for diagnostics; formatting can be a separate token/AST printer. | Do not use regex rewriting as a formatter. Reuse runtime `lex`/`parse` locations and emit `fl-diagnostics/1`; retain builder-aware triple-string/style handling. |
| 2. `row.severity` field access | `SYNTAX_SUGAR` | Yes: lower to `(get row "severity")`; nested access lowers to `get-in`. | Must be implemented in both Front source lowering and Island emitter/parser. No new runtime value model is required. |
| 3. Destructuring | `PARSER_AST_CHANGE` | Partly. Existing pattern AST helps, but `let`/function parameter binding lacks a Front-wide destructuring contract. | Define binding patterns, scope/error semantics, and Island emission before accepting syntax. Regex expansion is unsafe. |
| 4. Optional types and contracts | `STATIC_ANALYSIS` | Partly. Canonical parser already records some type annotations and Front has `scanTypeAnnotations`/contract readiness reporting. | Start opt-in and diagnostic-only; do not make existing unannotated pages fail. Island value/type coverage needs explicit tests. |
| 5. `result` / `match` error handling | `NEEDS_FURTHER_PROOF` | Tagged maps can represent `ok`/`err`, and core parser already has pattern-match AST. | Prove Front SSR, API JSON serialization, and Island emitter semantics agree on constructors, exhaustiveness, and async `fetch!` errors before classifying as syntax-only. |
| 6. `resource` / `mutation` | `RUNTIME_CHANGE` | No, not safely. | Lifetime, cancellation, cache invalidation, optimistic updates, and error/retry behavior require Island runtime state/effect semantics, not a textual lowering. |
| 7. HTML multiple children and component syntax | `PARSER_AST_CHANGE` | Multiple SSR children can lower to `(str ...)`, and functions can be component-like today; however safe general component syntax needs structured argument/child parsing. | Island already supports variadic children in `emitH`; SSR injected `h` is fixed arity. First prove a shared child/attribute AST before changing either surface. |
| 8. Explicit module and public-function boundaries | `NEEDS_FURTHER_PROOF` | Core AST/runtime already has `MODULE`/`IMPORT`/`OPEN`, but current Front instead regex-inlines `load` and textually rewrites `ns`. | Decide whether Front adopts core module semantics or defines a compatible Front layer. Visibility, duplicate loads, cycles, routes, and Island imports need proof tests first. |

## Recommended implementation order and regression risk

1. **DX-1: formatter + parenthesis diagnostics** — keep source language unchanged; add parser/token-based tests and preserve existing build diagnostics. **Risk: low-to-medium**, primarily false positives around triple strings, CSS DSL, and generated snippets.
2. **Repair the `compile` no-`-o` CLI defect independently** — add a regression test for positional argument selection. **Risk: low**, but it belongs to bundled runtime/AFJ provenance, not a Front syntax rewrite.
3. **Field-access sugar** — introduce only after paired SSR/API and Island snapshot tests prove it lowers exactly to existing `get`/`get-in`. **Risk: medium**, due to symbol/string/comment handling and nil semantics.
4. **Optional contracts/types** — diagnostic-only, versioned schema, no default enforcement. **Risk: medium**, as build warnings must not become accidental hard failures.
5. **Result/match proof spike** — specify tagged result values and exercise SSR, JSON API, Island callback, and rendering paths. **Risk: medium-to-high**.
6. **Destructuring and component children syntax** — use a shared Front syntax AST or a documented lowering AST; do not duplicate ad-hoc parsers. **Risk: high**, especially scope, attributes, and diagnostics.
7. **Explicit modules/public boundaries** — first choose one module model and migration path from `load`/`ns`. **Risk: high**, because Front currently relies on inlining and route-wide helper visibility.
8. **Resources/mutations** — only after the result/error and module contracts are stable. **Risk: highest**, because this changes Island lifecycle/runtime behavior.

## Non-goals and operations

- PM2 was not queried successfully or changed; no process was started, restarted, stopped, or deleted.
- Port `40860` was not contacted or used as a success criterion.
- No full `fl-front-build.js` build, formatter, fix command, commit, or push was run.
- The `freelang-v11-fx` checkout name mismatch noted by workspace guidance was not relevant to these Front compile paths and was not switched.

## Final verification record

```text
USER_CHANGES_PRESERVED=PASS
USER_CHANGE_FILES=.build-state.json, fl-front-init.js
USER_CHANGE_SHA256_MATCH=PASS (values recorded above and rechecked after documentation)
SSR_COMPILE=PASS
API_COMPILE=PASS
ISLAND_COMPILE=PASS
JS_SYNTAX_CHECK=PASS
GENERATED_OUTPUT_UNCHANGED=PASS (no full builder invoked; tracked output hashes rechecked)
RUNTIME_PROCESS_UNCHANGED=PASS (no lifecycle command issued)
IMPLEMENTATION_PATH_EVIDENCE=PASS
DX_CLASSIFICATION=PASS (8 items classified)
```
