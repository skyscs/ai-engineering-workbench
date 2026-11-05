import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { OwnedFileParser } from '../../apps/loredock/dist/file-parser.js';
import { typescriptFacts } from '../../apps/loredock/dist/code-typescript.js';
import { javaFacts } from '../../apps/loredock/dist/code-java.js';

const operation = signal => ({ deadline: performance.now() + 15000, ...(signal ? { signal } : {}) });
test('built parser preserves useful language facts and rejects expired or pre-cancelled admission', async t => {
  const parser = new OwnedFileParser(); t.after(() => parser.stop());
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(parser.start(operation(cancelled.signal)), { code: 'PARSER_CANCELLED' });
  assert.equal(parser.snapshot().state, 'new'); await parser.start(operation());
  for (const [path, content] of [
    ['orders.ts', 'export function orders() { return fetch("/orders"); }'],
    ['Orders.java', 'class Orders { public void accept(String order) { kafka.send("orders", order); } }'],
  ]) {
    const expected = path.endsWith('.java') ? javaFacts(content) : typescriptFacts(content, path);
    assert.equal(JSON.stringify(await parser.parse(path, content, operation())), JSON.stringify(expected));
    assert.ok(expected.symbols.length);
  }
  await assert.rejects(parser.parse('late.ts', '', { deadline: performance.now() - 1 }), { code: 'PARSER_DEADLINE' });
  assert.equal(parser.snapshot().state, 'ready'); await parser.stop(); assert.equal(parser.snapshot().owned, false);
});

test('parent process exit leaves no independently running parser process', async () => {
  const source = `const { OwnedFileParser } = await import(${JSON.stringify(new URL('../../apps/loredock/dist/file-parser.js', import.meta.url).href)});
    const parser = new OwnedFileParser(); await parser.start({ deadline: performance.now() + 15000 });
    console.log(JSON.stringify(parser.snapshot())); process.exit(0);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { env: {}, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 4096) child.kill('SIGKILL'); });
  child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 4096) child.kill('SIGKILL'); });
  const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
  try {
    const [exit, signal] = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (...args) => resolve(args)); });
    assert.equal(exit, 0, stderr); assert.equal(signal, null); assert.equal(stderr, '');
    const result = JSON.parse(stdout); assert.equal(result.state, 'ready'); assert.equal(result.owned, true);
    assert.ok(result.threadId > 0);
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); }
});
