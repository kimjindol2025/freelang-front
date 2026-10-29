// Regression of emitted browser syntax, do result, and length precedence.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const compiler = require('../island-compiler.js');
const runtime = compiler.FL_ISLAND_RT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
assert.doesNotThrow(() => new vm.Script(runtime));
const { scripts } = compiler.compileFileIslands('(island Closure [] (let [items (atom [1])] (do (length (deref items)) (h "p" {} (if (= (length (deref items)) 0) "empty" "present")))))');
let rendered;
const fl = {
  atom: v=>({v}), deref:a=>a.v,
  h: (tag, attrs, ...children)=>({tag, children}),
  mount: (_, render)=>{rendered=render(()=>{});}
};
vm.runInNewContext(scripts.join('\n'), {_fl: fl});
assert.equal(rendered.tag, 'p');
assert.equal(rendered.children[0], 'present');
console.log('ISLAND_RUNTIME_SYNTAX=PASS\nDO_LAST_VALUE=PASS\nLENGTH_PRECEDENCE=PASS');
