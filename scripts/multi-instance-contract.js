#!/usr/bin/env node
/**
 * FreeLang Front multi-instance contract.
 * This is a release harness, not product logic.
 */
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = process.env.FREELANG_AFJ_RUNNER || path.join(ROOT, 'runtime', 'bootstrap.js');
const PORTS = [
  Number(process.env.FL_MULTI_PORT_A || 47200 + Math.floor(Math.random() * 300)),
  Number(process.env.FL_MULTI_PORT_B || 47500 + Math.floor(Math.random() * 300)),
];
const TIMEOUT_MS = Number(process.env.FL_MULTI_TIMEOUT_MS || 15000);
const children = [];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function start(port) {
  const child = spawn(process.execPath, [RUNNER, 'run', 'server.fl'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      FL_HTTP_ALLOW: '127.0.0.1,localhost',
      FL_FRONT_COLLECTION_ADAPTER: 'memory',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.logs = '';
  child.stdout.on('data', chunk => { child.logs += String(chunk); });
  child.stderr.on('data', chunk => { child.logs += String(chunk); });
  children.push(child);
  return child;
}

async function request(port, route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      signal: controller.signal,
      headers: { accept: 'text/html,application/json' },
    });
    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer(port) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const result = await request(port, '/api/hello');
      if (result.status === 200) return result;
      lastError = `status=${result.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(150);
  }
  throw new Error(`port ${port} did not become ready: ${lastError}`);
}

function apiPass(body) {
  try {
    const json = JSON.parse(body);
    return json.ok === true && json.message === 'Hello from FL-Front API';
  } catch (_) {
    return false;
  }
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  await new Promise(resolve => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGTERM');
      resolve();
    }, 2000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  const instances = [];
  try {
    PORTS.forEach(start);
    await Promise.all(PORTS.map(waitForServer));
    for (const port of PORTS) {
      const api = await request(port, '/api/hello');
      const people = await request(port, '/people');
      const dashboard = await request(port, '/dashboard');
      const eventStreamExample = await request(port, '/examples/37-event-stream-contract');
      instances.push({
        port,
        api: api.status === 200 && apiPass(api.body),
        people: people.status === 200 && people.body.includes('사람'),
        dashboard: dashboard.status === 200 && dashboard.body.includes('대시보드'),
        event_stream_example: eventStreamExample.status === 200
          && eventStreamExample.body.includes('event-stream'),
      });
    }
    const pass = instances.length === 2 && instances.every(item =>
      item.api && item.people && item.dashboard && item.event_stream_example);
    console.log(JSON.stringify({ schema: 'fl-front-multi-instance/1', pass, ports: PORTS, instances }));
    process.exitCode = pass ? 0 : 2;
  } catch (error) {
    console.log(JSON.stringify({
      schema: 'fl-front-multi-instance/1', pass: false, ports: PORTS, error: error.message,
      logs: children.map((child, index) => ({ port: PORTS[index], tail: child.logs.slice(-1200) })),
    }));
    process.exitCode = 2;
  } finally {
    await Promise.all(children.map(stop));
  }
}

main();
