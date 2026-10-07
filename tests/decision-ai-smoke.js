const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

function runFreeLang(cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['runtime/bootstrap.js', 'run', 'tests/decision-ai-smoke.fl'], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function main() {
  let seen;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      seen = { method: req.method, url: req.url, headers: req.headers, body: JSON.parse(body) };
      const result = {
        id: 'resp_test_decision',
        status: 'completed',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              option_id: 'canary',
              recommendation: 'Canary',
              confidence: 0.91,
              reasoning: 'Small user population limits blast radius.',
              risks: ['Longer rollout time'],
              next_action: 'Define rollback threshold',
            }),
          }],
        }],
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/v1/responses`;

  try {
    const result = await runFreeLang(process.cwd(), {
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'test-model',
      OPENAI_BASE_URL: baseUrl,
      FL_HTTP_ALLOW: '127.0.0.1,localhost',
    });
    assert.strictEqual(result.code, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout.trim().split('\n').pop());
    assert.strictEqual(parsed.ok, true, JSON.stringify({ parsed, stdout: result.stdout, stderr: result.stderr, seen }));
    assert.strictEqual(parsed.decision.option_id, 'canary');
    assert.strictEqual(parsed.provider.id, 'resp_test_decision');
    assert.strictEqual(seen.method, 'POST');
    assert.strictEqual(seen.url, '/v1/responses');
    assert.strictEqual(seen.headers.authorization, 'Bearer test-key');
    assert.ok(seen.headers['x-client-request-id']);
    assert.strictEqual(seen.body.text.format.type, 'json_schema');
    assert.strictEqual(seen.body.store, false);
    console.log('decision-ai smoke: PASS');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
