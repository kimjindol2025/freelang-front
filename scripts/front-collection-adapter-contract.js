#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 46000 + Math.floor(Math.random() * 500);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-front-collection-'));
let child = null;

function copy(name) {
  fs.cpSync(path.join(ROOT, name), path.join(temp, name), { recursive: true });
}

async function waitForServer(url) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(url);
      if (response.status > 0) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('temporary FreeLang server did not start');
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch (_) {}
  return { status: response.status, json };
}

async function main() {
  fs.mkdirSync(path.join(temp, 'data'));
  for (const name of ['server.fl', '_app.fl', 'freelang-stdlib-extensions.fl']) copy(name);
  copy('public');
  const serverPath = path.join(temp, 'server.fl');
  fs.writeFileSync(serverPath, fs.readFileSync(serverPath, 'utf8').replace('(define PORT 40860)', `(define PORT ${PORT})`));

  child = spawn(process.execPath, [path.join(ROOT, 'runtime', 'bootstrap.js'), 'run', 'server.fl'], {
    cwd: temp,
    env: {
      ...process.env,
      PORT: String(PORT),
      FL_FRONT_COLLECTION_ADAPTER: 'memory',
      FL_HTTP_ALLOW: '127.0.0.1,localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

  const base = `http://127.0.0.1:${PORT}`;
  await waitForServer(`${base}/bookmarks/api`);
  const empty = await request(base, '/bookmarks/api');
  if (empty.status !== 200 || empty.json?.ok !== true || !Array.isArray(empty.json.items)) {
    throw new Error(`initial collection contract failed: ${JSON.stringify(empty)}`);
  }
  const added = await request(base, '/bookmarks/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'action=add&title=front-memory-contract&url=https%3A%2F%2Fexample.test',
  });
  const item = added.json?.items?.find((candidate) => candidate.title === 'front-memory-contract');
  if (added.status !== 200 || added.json?.ok !== true || !item?.id) {
    throw new Error(`memory create contract failed: ${JSON.stringify(added)}`);
  }
  const removed = await request(base, '/bookmarks/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `action=delete&id=${encodeURIComponent(item.id)}`,
  });
  if (removed.status !== 200 || removed.json?.ok !== true
    || removed.json.items?.some((candidate) => String(candidate.id) === String(item.id))) {
    throw new Error(`memory delete contract failed: ${JSON.stringify(removed)}`);
  }
  const form = (values) => new URLSearchParams(values).toString();
  const scratchAdd = await request(base, '/scratch/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ action: 'add', title: 'front-memory-scratch', body: 'before-update' }),
  });
  const scratchItem = scratchAdd.json?.items?.find((candidate) => candidate.title === 'front-memory-scratch');
  if (scratchAdd.status !== 200 || scratchAdd.json?.ok !== true || !scratchItem?.id) {
    throw new Error(`memory scratch create contract failed: ${JSON.stringify(scratchAdd)}`);
  }
  const scratchUpdate = await request(base, '/scratch/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ action: 'update', id: scratchItem.id, title: 'front-memory-scratch-updated', body: 'after-update' }),
  });
  if (scratchUpdate.status !== 200 || scratchUpdate.json?.ok !== true
    || scratchUpdate.json.item?.title !== 'front-memory-scratch-updated') {
    throw new Error(`memory update contract failed: ${JSON.stringify(scratchUpdate)}`);
  }
  const scratchHistory = await request(base, '/scratch/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ action: 'history', id: scratchItem.id }),
  });
  if (scratchHistory.status !== 200 || scratchHistory.json?.ok !== true
    || !Array.isArray(scratchHistory.json.events)) {
    throw new Error(`memory history contract failed: ${JSON.stringify(scratchHistory)}`);
  }
  const scratchDelete = await request(base, '/scratch/api', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ action: 'delete', id: scratchItem.id }),
  });
  if (scratchDelete.status !== 200 || scratchDelete.json?.ok !== true
    || scratchDelete.json.items?.some((candidate) => String(candidate.id) === String(scratchItem.id))) {
    throw new Error(`memory scratch delete contract failed: ${JSON.stringify(scratchDelete)}`);
  }
  console.log(JSON.stringify({
    schema: 'fl-front-collection-adapter/1',
    pass: true,
    profile: 'memory-test',
    route: '/bookmarks/api',
    operations: ['list', 'create', 'update', 'history', 'delete'],
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    schema: 'fl-front-collection-adapter/1',
    pass: false,
    message: error.message,
  }));
  process.exitCode = 1;
}).finally(() => {
  if (child && !child.killed) child.kill('SIGINT');
  fs.rmSync(temp, { recursive: true, force: true });
});
