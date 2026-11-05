import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { OwnedFileParser } from '../src/file-parser.js';
import { FileParserOwner } from '../src/file-parser-owner.js';
import { fileParserIdentity } from '../src/file-parser-identity.js';
import { FileParserError, decodeParseRequest, encodeParserFrame, fileParserDigest, fileParserLimits, fileParserProtocol } from '../src/file-parser-protocol.js';
import { typescriptFacts } from '../src/code-typescript.js';
import { javaFacts } from '../src/code-java.js';
import { factRanges } from '../src/code-analysis-facts.js';

const operation = (signal?: AbortSignal) => ({ deadline: performance.now() + 15000, ...(signal ? { signal } : {}) });
const code = (expected: string) => (error: unknown) => error instanceof FileParserError && error.code === expected;
const identity = 'a'.repeat(64);
const cases: [string, string][] = [
  ['src/client.ts', 'export function load() { return fetch("/orders", { headers: { "X-Tenant": "demo" } }); }'],
  ['src/client.js', 'export function publish(event) { kafka.send("orders-created", event); }'],
  ['src/Checkout.vue', '<script setup lang="ts">function checkout() { fetch("/orders"); }</script><template><button @click="checkout">Buy</button></template>'],
  ['src/Orders.java', 'class Orders { public void send(String order) { kafka.send("orders-created", order); } }'],
  ['src/unicode.ts', '// 🚢 café\nexport function getOrder() { return fetch("/orders"); }'],
  ['src/broken.ts', 'export function ( {'],
  ['src/Unsupported.vue', '<template><div>Unsupported envelope</div></template>'],
  ['src/Escapes.java', String.raw`class Escapes { String value = "\u000a"; }`],
];

test('owned source worker preserves exact facts and original ranges, then joins exit', async t => {
  const parser = new OwnedFileParser(); t.after(() => parser.stop());
  assert.equal(parser.snapshot().state, 'new'); assert.equal(parser.snapshot().threadId, null);
  await parser.start(operation());
  let symbols = 0, operations = 0, gaps = 0;
  for (const [path, content] of cases) {
    const expected = path.endsWith('.java') ? javaFacts(content) : typescriptFacts(content, path);
    const actual = await parser.parse(path, content, operation());
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), path);
    assert.deepEqual(factRanges(content, actual), factRanges(content, expected));
    symbols += actual.symbols.length; operations += actual.operations.length; gaps += actual.gaps.length;
  }
  assert.ok(symbols >= 4 && operations >= 2 && gaps >= 2);
  await parser.stop(); assert.equal(parser.snapshot().state, 'closed'); assert.equal(parser.snapshot().owned, false);
  assert.equal(typeof parser.snapshot().exitCode, 'number'); await parser.stop();
  await assert.rejects(parser.parse('late.ts', '', operation()), code('PARSER_STATE'));
});

test('request framing retains exact escaped text and refuses unsafe paths, extra fields and excess bytes', () => {
  const content = '\u0000'.repeat(32768), path = 'src/escaped.ts';
  const request = { version: fileParserProtocol, generation: 'b'.repeat(36), identity, type: 'parse', id: 1,
    path, content, digest: fileParserDigest(path, content) };
  assert.deepEqual(decodeParseRequest(encodeParserFrame(request, fileParserLimits.requestBytes)), request);
  for (const patch of [{ path: '../escape.ts' }, { content: content + 'x' }, { extra: true }, { digest: '0'.repeat(64) }]) {
    assert.throws(() => decodeParseRequest(encodeParserFrame({ ...request, ...patch }, fileParserLimits.requestBytes)), FileParserError);
  }
  assert.throws(() => decodeParseRequest(new ArrayBuffer(fileParserLimits.requestBytes + 1)), code('PARSER_FRAME_LIMIT'));
});

const fixture = `
const { parentPort: port, workerData: data } = require('node:worker_threads');
const binding = { version: 'loredock-file-parser/1', generation: data.generation, identity: '${identity}' };
const send = value => { const bytes = Buffer.from(JSON.stringify(value)); const frame = new ArrayBuffer(bytes.length); new Uint8Array(frame).set(bytes); port.postMessage(frame, [frame]); };
if (data.mode === 'start-exit') process.exit(7);
if (data.mode === 'start-hang') { while (true) {} }
send({ ...binding, type: 'ready' });
port.on('message', frame => {
  const request = JSON.parse(Buffer.from(frame).toString());
  if (data.mode === 'hang') { while (true) {} }
  if (data.mode === 'exit') process.exit(9);
  if (data.mode === 'error') throw new Error('Synthetic parser failure');
  if (data.mode === 'invalid-utf8') { port.postMessage(Uint8Array.of(255).buffer); return; }
  if (data.mode === 'oversized') { port.postMessage(new ArrayBuffer(512 * 1024 + 1)); return; }
  const result = { ...binding, type: 'facts', id: request.id, digest: request.digest,
    facts: { symbols: [], operations: [], calls: [], records: {}, gaps: [] } };
  if (data.mode === 'wrong-id') result.id++;
  if (data.mode === 'wrong-generation') result.generation = 'f'.repeat(36);
  if (data.mode === 'wrong-digest') result.digest = '0'.repeat(64);
  if (data.mode === 'extra') result.facts.extra = true;
  if (data.mode === 'invalid-range') result.facts.symbols.push({key:'a',name:'a',qualifiedName:'a',role:'function',exported:false,start:0,end:999});
  if (data.mode === 'unknown-owner') result.facts.calls.push({owner:'missing',local:'a',imported:'b',module:'c'});
  send(result);
  if (data.mode === 'duplicate') send(result);
  if (data.mode === 'exit-after-result') process.exit(0);
});
`;
function controlled(mode: string, cleanupMs?: number) {
  const workers: Worker[] = [], exits: number[] = [];
  const parser = new FileParserOwner({ identify: async () => identity, spawn: generation => {
    const worker = new Worker(fixture, { eval: true, workerData: { generation, mode }, execArgv: [], env: {}, stdout: true, stderr: true });
    workers.push(worker); worker.once('exit', value => exits.push(value)); return worker;
  }, ...(cleanupMs ? { cleanupMs } : {}) });
  return { parser, workers, exits };
}

test('busy rejects without a hidden queue and cancellation joins a busy real thread', async t => {
  const { parser, workers, exits } = controlled('hang'); t.after(() => parser.stop()); await parser.start(operation());
  const controller = new AbortController(), pending = parser.parse('hang.ts', 'const x = 1;', operation(controller.signal));
  const rejected = assert.rejects(pending, code('PARSER_CANCELLED'));
  await assert.rejects(parser.parse('second.ts', 'x'.repeat(40000), operation()), code('PARSER_BUSY'));
  controller.abort(); await rejected;
  assert.equal(workers.length, 1); assert.equal(exits.length, 1); assert.equal(parser.snapshot().owned, false);
  await parser.stop(); assert.equal(parser.snapshot().requests, 1);
});

test('a parse deadline and explicit stop during parsing both join the active thread', async () => {
  for (const stop of [false, true]) {
    const { parser, exits } = controlled('hang'); await parser.start(operation());
    const pending = parser.parse('hang.ts', 'x', { deadline: performance.now() + 100 });
    const rejected = assert.rejects(pending, code(stop ? 'PARSER_STOPPED' : 'PARSER_DEADLINE'));
    if (stop) await parser.stop();
    await rejected; await parser.stop(); assert.equal(exits.length, 1); assert.equal(parser.snapshot().owned, false);
  }
});

test('abort during identity initialization prevents a late worker from being created', async () => {
  let finish!: (identity: string) => void, spawns = 0;
  const parser = new FileParserOwner({ identify: () => new Promise(resolve => { finish = resolve; }), spawn: () => { spawns++; throw new Error('Unexpected spawn'); } });
  const controller = new AbortController(), starting = parser.start(operation(controller.signal));
  const rejected = assert.rejects(starting, code('PARSER_CANCELLED')); controller.abort(); finish(identity);
  await rejected; await parser.stop(); assert.equal(spawns, 0); assert.equal(parser.snapshot().state, 'closed');
});

test('deadline during initialization, explicit stop during startup and startup exit settle after cleanup', async () => {
  for (const mode of ['start-hang', 'start-exit']) {
    const { parser, exits } = controlled(mode);
    try {
      await assert.rejects(parser.start({ deadline: performance.now() + 500 }), code(mode === 'start-exit' ? 'PARSER_EXIT' : 'PARSER_DEADLINE'));
      assert.equal(exits.length, 1); assert.equal(parser.snapshot().owned, false);
    } finally { await parser.stop(); }
  }
  const { parser, exits } = controlled('start-hang');
  const starting = parser.start(operation()), rejected = assert.rejects(starting, code('PARSER_STOPPED'));
  await turn(); await parser.stop(); await rejected;
  assert.equal(exits.length, 1); assert.equal(parser.snapshot().owned, false);
});

test('malformed, oversized, mismatched and failed real worker replies close their generation', async () => {
  for (const [mode, expected] of [['exit', 'PARSER_EXIT'], ['error', 'PARSER_WORKER_ERROR'], ['invalid-utf8', 'PARSER_PROTOCOL'],
    ['oversized', 'PARSER_FRAME_LIMIT'], ['wrong-id', 'PARSER_PROTOCOL'], ['wrong-generation', 'PARSER_PROTOCOL'],
    ['wrong-digest', 'PARSER_PROTOCOL'], ['extra', 'PARSER_PROTOCOL'], ['invalid-range', 'PARSER_PROTOCOL'], ['unknown-owner', 'PARSER_PROTOCOL']]) {
    const { parser, workers, exits } = controlled(mode!);
    try {
      await parser.start(operation()); await assert.rejects(parser.parse('input.ts', 'x', operation()), code(expected!));
      assert.equal(exits.length, 1, mode); assert.equal(workers.length, 1, mode); assert.equal(parser.snapshot().owned, false);
      await assert.rejects(parser.parse('again.ts', '', operation()), code('PARSER_STATE'));
    } finally { await parser.stop(); }
  }
});

test('duplicate reply or exit after a result prevents subsequent reuse without rewriting the first result', async () => {
  for (const mode of ['duplicate', 'exit-after-result']) {
    const { parser, workers } = controlled(mode);
    try {
      await parser.start(operation()); const ended = new Promise<void>(resolve => workers[0]!.once('exit', () => resolve()));
      assert.deepEqual(await parser.parse('empty.ts', '', operation()), { symbols: [], operations: [], calls: [], records: {}, gaps: [] });
      await ended; await parser.stop(); assert.equal(parser.snapshot().owned, false);
      assert.equal(parser.snapshot().terminalCode, mode === 'duplicate' ? 'PARSER_PROTOCOL' : 'PARSER_EXIT');
    } finally { await parser.stop(); }
  }
});

test('cleanup timeout reports incomplete ownership until an actual late exit', async t => {
  const { parser, workers } = controlled('hang', 30); await parser.start(operation());
  const worker = workers[0]!, terminate = worker.terminate.bind(worker); t.after(async () => { await terminate(); });
  worker.terminate = async () => 0;
  const controller = new AbortController(), pending = parser.parse('input.ts', 'x', operation(controller.signal));
  const rejected = assert.rejects(pending, code('PARSER_CLEANUP_TIMEOUT')); controller.abort(); await rejected;
  assert.equal(parser.snapshot().state, 'stopping'); assert.equal(parser.snapshot().owned, true);
  assert.equal(parser.snapshot().cleanupIncomplete, true);
  await assert.rejects(parser.stop(), code('PARSER_CLEANUP_TIMEOUT'));
  await terminate(); await turn(); assert.equal(parser.snapshot().state, 'closed'); assert.equal(parser.snapshot().owned, false);
});

test('identity is deterministic, independently abortable and does not create a parser owner', async () => {
  assert.match(await fileParserIdentity(), /^[a-f0-9]{64}$/);
  assert.equal(await fileParserIdentity(), await fileParserIdentity());
  const controller = new AbortController(); controller.abort(); await assert.rejects(fileParserIdentity(controller.signal));
});
