(function (global) {
  function createFx2Wasm(Module) {
    var stdout = [];
    var stderr = [];
    var previousPrint = Module.print;
    var previousPrintErr = Module.printErr;

    Module.print = function (text) {
      stdout.push(String(text));
      if (previousPrint) previousPrint(text);
    };
    Module.printErr = function (text) {
      stderr.push(String(text));
      if (previousPrintErr) previousPrintErr(text);
    };

    var ready = new Promise(function (resolve) {
      var previous = Module.onRuntimeInitialized;
      Module.onRuntimeInitialized = function () {
        if (previous) previous();
        resolve(api);
      };
    });

    var api = {
      ready: ready,
      lastStdout: "",
      lastStderr: "",
      lastRuntimeMs: 0,
      lastPassed: false,
      smoke: function () {
        stdout.length = 0;
        stderr.length = 0;
        var start = (global.performance && performance.now) ? performance.now() : Date.now();
        var passed = Module.ccall('fx2_wasm_smoke', 'number', [], []) === 1;
        var end = (global.performance && performance.now) ? performance.now() : Date.now();
        api.lastRuntimeMs = Math.max(0, Math.round(end - start));
        api.lastStdout = stdout.join('\n').trim();
        api.lastStderr = stderr.join('\n').trim();
        api.lastPassed = passed;
        return passed;
      },
      onClick: function (selector, handler) {
        var node = document.querySelector(selector);
        if (!node) throw new Error('missing DOM node: ' + selector);
        node.addEventListener('click', handler);
        return function () { node.removeEventListener('click', handler); };
      },
      onInput: function (selector, handler) {
        var node = document.querySelector(selector);
        if (!node) throw new Error('missing DOM node: ' + selector);
        var listener = function (event) { handler(event.target.value, event); };
        node.addEventListener('input', listener);
        return function () { node.removeEventListener('input', listener); };
      }
    };
    return api;
  }

  global.createFx2Wasm = createFx2Wasm;
})(window);
