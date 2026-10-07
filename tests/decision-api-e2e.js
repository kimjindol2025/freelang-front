const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

const FRONT_PORT = Number(process.env.FRONT_TEST_PORT || 40860);

function request(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: FRONT_PORT, path, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers },
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setInterval(() => {
      const probe = http.get(`http://127.0.0.1:${FRONT_PORT}/api/decision`, (res) => {
        res.resume();
        clearInterval(timer);
        resolve(output);
      });
      probe.on('error', () => {});
    }, 100);
    const timeout = setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`front server did not start: ${output}`));
    }, 10000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('exit', (code) => {
      clearInterval(timer);
      clearTimeout(timeout);
      reject(new Error(`front server exited early (${code}): ${output}`));
    });
  });
}

async function main() {
  let providerRequest;
  const provider = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const input = JSON.parse(body);
      providerRequest = input;
      assert.strictEqual(req.headers.authorization, 'Bearer test-openai-key');
      assert.ok(req.headers['x-client-request-id']);
      assert.strictEqual(input.text.format.type, 'json_schema');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'resp_e2e_decision', status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
          option_id: 'safe', recommendation: 'Safe path', confidence: 0.87,
          reasoning: 'It has the lower operational risk.', risks: [], next_action: 'Run the small rollout',
        }) }] }],
      }));
    });
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const providerUrl = `http://127.0.0.1:${provider.address().port}/v1/responses`;
  const front = spawn(process.execPath, ['runtime/bootstrap.js', 'run', 'server.fl'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_BASE_URL: providerUrl,
      OPENAI_MODEL: 'test-model',
      DECISION_API_KEY: 'internal-token',
      PORT: String(FRONT_PORT),
      FL_HTTP_ALLOW: '127.0.0.1,localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(front);
    const input = { question: 'Which path?', options: [{ id: 'safe', label: 'Safe path' }, { id: 'fast', label: 'Fast path' }] };
    const unauthorized = await request('/api/decision', input);
    assert.strictEqual(unauthorized.status, 401);
    const authorized = await request('/api/decision', input, { authorization: 'Bearer internal-token' });
    assert.strictEqual(authorized.status, 200, JSON.stringify({ response: authorized.body, providerRequest }));
    assert.strictEqual(authorized.body.ok, true);
    assert.strictEqual(authorized.body.decision.option_id, 'safe');
    assert.strictEqual(authorized.body.provider.id, 'resp_e2e_decision');
    console.log('decision-api e2e: PASS');
  } finally {
    front.kill('SIGTERM');
    await new Promise((resolve) => front.once('exit', resolve));
    await new Promise((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
