#!/usr/bin/env node
/**
 * HTTP-level contract for the Front SPA bridge.
 * Schema: fl-spa-contract/1
 *
 * This gate does not pretend to be a browser test. It verifies the server
 * response and the CSP-safe client bridge; real click/interaction evidence is
 * recorded separately through the browser observability flow.
 */
'use strict';

const base = process.env.BASE_URL || process.env.FL_FRONT_BASE_URL || 'http://127.0.0.1:40860';
const routes = ['/people', '/market'];

async function request(route) {
  const response = await fetch(new URL(route, base), {
    headers: { 'X-SPA': '1', accept: 'text/html' },
  });
  return {
    route,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    csp: response.headers.get('content-security-policy') || '',
    text: await response.text(),
  };
}

async function main() {
  const pages = await Promise.all(routes.map(request));
  const checks = [];
  const headersPass = pages.every((page) => page.status === 200 && /text\/html/i.test(page.contentType));
  checks.push({
    name: 'http-pages',
    status: headersPass ? 'PASS' : 'FAIL',
    detail: pages.map((page) => `${page.route}=${page.status}`).join(' '),
  });

  const layoutPass = pages.every((page) => /layout_wrap/.test(page.text) && /data-spa/.test(page.text));
  checks.push({
    name: 'layout-spa-markers',
    status: layoutPass ? 'PASS' : 'FAIL',
    detail: layoutPass ? 'layout and data-spa markers present' : 'missing layout or SPA marker',
  });

  const mountPass = pages.every((page) => /_fl\.mount\("island-/.test(page.text));
  checks.push({
    name: 'island-mount',
    status: mountPass ? 'PASS' : 'FAIL',
    detail: mountPass ? 'compiled Island mount present in both routes' : 'compiled Island mount missing',
  });

  const cspPass = pages.every((page) => /script-src[^;]*'unsafe-inline'/.test(page.csp) && !/unsafe-eval/.test(page.csp));
  checks.push({
    name: 'csp-safe-bridge',
    status: cspPass ? 'PASS' : 'FAIL',
    detail: cspPass ? 'unsafe-inline allowed, unsafe-eval absent' : 'CSP does not enforce the SPA bridge boundary',
  });

  const sourcePass = pages.every((page) => !/eval\s*\(s\.textContent\)/.test(page.text));
  checks.push({
    name: 'no-eval-bridge',
    status: sourcePass ? 'PASS' : 'FAIL',
    detail: sourcePass ? 'legacy eval bridge absent' : 'legacy eval bridge found',
  });

  const pass = checks.every((check) => check.status === 'PASS');
  const output = { schema: 'fl-spa-contract/1', base, routes, checks, pass };
  console.log(JSON.stringify(output));
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(`SPA_CONTRACT_FAIL ${error.message}`);
  process.exit(1);
});
