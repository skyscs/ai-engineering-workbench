import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate as turn } from 'node:timers/promises';
import { test } from 'node:test';
import { ControlledRuntime, runtimeLimits } from '../loredock-controlled-server/runtime.mjs';
import { beforeControlledServer } from '../../apps/loredock/tests/fixtures/controlled-server-reference/verify.mjs';

const connection = { executable: '/synthetic/never-executed', configHome: '/synthetic/no-auth', profile: null };
const request = signal => ({ prompt: 'Synthetic original context', schema: { properties: { claims: { items: {
  properties: { evidenceIds: { items: { enum: ['issued-original'] } } } } } } }, model: 'controlled-only', effort: 'medium', signal });
async function setup(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-controlled-runtime-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, runtime: new ControlledRuntime(directory) };
}

test('controlled output retains exact inputs, uses an issued citation and closes one lease once', async t => {
  const { directory, runtime } = await setup(t), signal = new AbortController().signal;
  const prepared = await runtime.prepare(connection, signal), input = request(signal), result = await prepared.run(input);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'request-1.json'), 'utf8')), { prompt: input.prompt, schema: input.schema, model: input.model, effort: input.effort });
  assert.deepEqual(JSON.parse(result.text).claims[0].evidenceIds, ['issued-original']);
  assert(JSON.parse(result.text).unknowns.every(value => value.endsWith('?')));
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'output-1.json'), 'utf8')), result);
  await assert.rejects(prepared.run(input), /cannot run again/);
  const close = prepared.close(); assert.equal(prepared.close(), close); await close;
  assert.equal(runtime.snapshot().closed, 1); assert.equal(runtime.snapshot().active, false); assert.equal(runtime.snapshot().modelCalls, 0);
});

test('releasing a held preparation or run completes the same owned request', async t => {
  for (const stage of ['prepare', 'run']) {
    const { runtime } = await setup(t), signal = new AbortController().signal; runtime.hold(stage);
    let prepared;
    const pending = stage === 'prepare' ? runtime.prepare(connection, signal)
      : (prepared = await runtime.prepare(connection, signal)).run(request(signal));
    runtime.release();
    if (stage === 'prepare') { prepared = await pending; await prepared.run(request(signal)); }
    else await pending;
    await prepared.close(); assert.equal(runtime.snapshot().closed, 1);
    assert.equal(runtime.snapshot().aborted, 0); assert.equal(runtime.snapshot().active, false);
    assert.throws(() => runtime.release(), /No controlled hold/);
  }
});

test('prepare and run holds respond to abort without a late output or an owned request', async t => {
  for (const stage of ['prepare', 'run']) {
    const { directory, runtime } = await setup(t), controller = new AbortController(); runtime.hold(stage);
    let prepared;
    const pending = stage === 'prepare' ? runtime.prepare(connection, controller.signal)
      : (prepared = await runtime.prepare(connection, controller.signal)).run(request(controller.signal));
    void pending.catch(() => undefined); await turn();
    await assert.rejects(runtime.prepare(connection, controller.signal), /already owns/);
    controller.abort(); await assert.rejects(pending); await prepared?.close();
    assert.equal(runtime.snapshot().active, false); assert.equal(runtime.snapshot().held, null);
    assert(!(await readdir(directory)).some(name => name.startsWith('output-')));
  }
});

test('closing a prepared lease joins its interrupted run and never allows reuse', async t => {
  const { runtime, directory } = await setup(t), signal = new AbortController().signal;
  runtime.hold('run'); const prepared = await runtime.prepare(connection, signal), pending = prepared.run(request(signal));
  void pending.catch(() => undefined);
  await prepared.close(); await assert.rejects(pending, /lease closed/);
  assert.equal(runtime.snapshot().active, false); assert.equal(runtime.snapshot().closed, 1);
  assert(!(await readdir(directory)).includes('output-1.json'));
});

test('controlled preparation count, request bytes and original-citation requirements are bounded', async t => {
  const { runtime, directory } = await setup(t), signal = new AbortController().signal;
  for (let i = 0; i < runtimeLimits.preparations; i++) {
    const prepared = await runtime.prepare(connection, signal), input = request(signal);
    if (i === 0) input.prompt = 'x'.repeat(runtimeLimits.requestBytes + 1);
    else input.schema.properties.claims.items.properties.evidenceIds.items.enum = [];
    await assert.rejects(prepared.run(input)); await prepared.close();
  }
  await assert.rejects(runtime.prepare(connection, signal), /preparation limit/);
  assert.deepEqual(await readdir(directory), []);
  assert.equal(runtime.snapshot().calls, 4); assert.equal(runtime.snapshot().closed, 4);
});

test('historical server verification permits only the explicit runtime seam', async () => {
  const file = 'apps/loredock/src/server.ts', raw = await readFile(new URL('../../' + file, import.meta.url));
  const before = beforeControlledServer(file, raw);
  assert(before.includes('new Answers(this.catalog, undefined, this.preparations)'));
  assert.throws(() => beforeControlledServer(file, Buffer.from(raw.toString().replace('await this.catalog.parser.warm', 'await this.catalog.parser.stop'))), /Undeclared/);
  assert.equal(beforeControlledServer(file, before), before);
});
