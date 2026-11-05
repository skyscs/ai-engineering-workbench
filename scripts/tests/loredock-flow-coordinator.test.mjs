import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { coordinateOrdinary, resourceCaseOrder } from '../loredock-prepared-flow/coordinator.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-flow-coordinator-'));
  t.diagnostic('Retained flow-coordinator test: ' + root);
  return { root, directory: path.join(root, 'run'), claimPath: path.join(root, 'consumed.json'), family: 'ordinary-sequence-control' };
}
const json = async file => JSON.parse(await readFile(file, 'utf8'));
function cases(run) { return resourceCaseOrder.map((id, index) => ({ id, requires: [], independentAfterFailure: true, run: args => run({ ...args, id, index }) })); }
async function result(directory, status = 'passed', safeToContinue = true) {
  await writeFile(path.join(directory, 'evidence.json'), JSON.stringify({ status, safeToContinue }), { flag: 'wx' });
  return { status, safeToContinue, artifacts: ['evidence.json'] };
}

test('fixed sequence is sequential, consumed before callbacks and cannot replay into a new output', async t => {
  const input = await fixture(t), calls = []; let active = 0;
  const handlers = cases(async ({ directory, id }) => {
    assert.equal(++active, 1); assert.equal((await json(input.claimPath)).family, input.family);
    const events = (await readFile(path.join(input.directory, 'sequence.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(events[0].event, 'started'); assert.equal(events.at(-1).event, 'case-started');
    if (id === resourceCaseOrder[0]) handlers[1].run = async () => { throw new Error('Later caller mutations must not alter the validated plan.'); };
    calls.push(id); await new Promise(resolve => setImmediate(resolve)); active--;
    return result(directory);
  });
  const report = await coordinateOrdinary({ ...input, cases: handlers });
  assert.deepEqual(calls, resourceCaseOrder); assert(report.allCasesPassed);
  assert.equal(report.qualification, false); assert.equal(report.modelEligibility, false);
  assert.equal(report.modelCalls, null); assert.equal(report.reservedFamilyReads, null);
  assert(report.cases.every(row => row.artifacts[0].bytes > 0 && /^[a-f0-9]{64}$/.test(row.artifacts[0].sha256)));
  const marker = await readFile(input.claimPath);
  await assert.rejects(coordinateOrdinary({ ...input, directory: path.join(input.root, 'replay'), cases: handlers }), error => error.code === 'EEXIST');
  assert.deepEqual(await readFile(input.claimPath), marker); assert.equal(calls.length, 15);
});

test('a failed positive stays failed while only explicitly independent cases run once', async t => {
  const input = await fixture(t), calls = [];
  const handlers = cases(async ({ directory, id, index }) => { calls.push(id); return result(directory, index === 0 ? 'failed' : 'passed'); });
  handlers[2].requires = [resourceCaseOrder[0]];
  handlers[3].independentAfterFailure = false;
  const report = await coordinateOrdinary({ ...input, cases: handlers });
  assert.equal(report.allCasesPassed, false); assert.equal(report.modelEligibility, false);
  assert.equal(report.cases[0].status, 'failed'); assert.equal(report.cases[1].status, 'passed');
  assert.equal(report.cases[2].reason, 'dependency-failed'); assert.equal(report.cases[3].reason, 'not-independent-after-failure');
  assert.equal(calls.filter(id => id === resourceCaseOrder[0]).length, 1);
  assert.equal(calls.length, 13); assert.equal(report.cases.length, 15);
});

test('an unclassified exception or missing evidence stops later callbacks without inventing passes', async t => {
  for (const failure of ['missing', 'exception', 'unsafe']) {
    const input = await fixture(t); let calls = 0;
    const report = await coordinateOrdinary({ ...input, cases: cases(async ({ directory }) => {
      calls++; if (failure === 'exception') throw new Error('Unclassified integrity failure.');
      if (failure === 'unsafe') return result(directory, 'passed', false);
      return { status: 'passed', safeToContinue: true, artifacts: ['missing.json'] };
    }) });
    assert.equal(calls, 1); assert.equal(report.cases[0].status, 'incomplete');
    if (failure === 'exception') assert.equal(report.cases[0].error.message, 'Unclassified integrity failure.');
    else if (failure === 'unsafe') assert.match(report.cases[0].error.message, /passed case cannot declare an unsafe continuation/);
    else assert.equal(report.cases[0].error.code, 'ENOENT');
    assert(report.cases.slice(1).every(row => row.status === 'not-run'));
    assert.equal(report.allCasesPassed, false);
  }
});

test('missing handlers, reordered cases and future dependencies fail before consumption', async t => {
  const input = await fixture(t); let calls = 0;
  const handlers = cases(async ({ directory }) => { calls++; return result(directory); });
  await assert.rejects(coordinateOrdinary({ ...input, cases: handlers.slice(1) }));
  await assert.rejects(coordinateOrdinary({ ...input, cases: handlers.toReversed() }));
  handlers[0].requires = [resourceCaseOrder[1]];
  await assert.rejects(coordinateOrdinary({ ...input, cases: handlers }));
  assert.equal(calls, 0); await assert.rejects(stat(input.claimPath), error => error.code === 'ENOENT');
  handlers[0].requires = [];
  await assert.rejects(coordinateOrdinary({ ...input, family: 'kiln-prepared-flow-127', cases: handlers }), /cannot execute a reserved family/);
});

test('an empty consumption marker still blocks execution', async t => {
  const input = await fixture(t); await writeFile(input.claimPath, '', { flag: 'wx' }); let calls = 0;
  await assert.rejects(coordinateOrdinary({ ...input, cases: cases(async ({ directory }) => { calls++; return result(directory); }) }), error => error.code === 'EEXIST');
  assert.equal(calls, 0); assert.equal((await readFile(input.claimPath)).length, 0);
});

test('evidence outside the case or behind a symlink is rejected without reading it', async t => {
  for (const kind of ['escape', 'symlink']) {
    const input = await fixture(t); let calls = 0;
    const outside = path.join(input.root, 'outside.json'); await writeFile(outside, 'outside evidence');
    const report = await coordinateOrdinary({ ...input, cases: cases(async ({ directory }) => {
      calls++; const file = kind === 'escape' ? '../../outside.json' : 'linked.json';
      if (kind === 'symlink') await symlink(outside, path.join(directory, file));
      return { status: 'passed', safeToContinue: true, artifacts: [file] };
    }) });
    assert.equal(calls, 1); assert.equal(report.cases[0].status, 'incomplete');
    assert(report.cases.slice(1).every(row => row.status === 'not-run'));
    assert.equal(await readFile(outside, 'utf8'), 'outside evidence');
  }
});

test('simultaneous attempts sharing a claim execute exactly one complete sequence', async t => {
  const input = await fixture(t); let calls = 0;
  const handlers = cases(async ({ directory }) => { calls++; await new Promise(resolve => setImmediate(resolve)); return result(directory); });
  const results = await Promise.allSettled(['one', 'two'].map(name => coordinateOrdinary({ ...input,
    directory: path.join(input.root, name), cases: handlers })));
  assert.equal(calls, 15); assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert(results.find(row => row.status === 'fulfilled').value.allCasesPassed);
  assert.equal(results.find(row => row.status === 'rejected').reason.code, 'EEXIST');
  const marker = await json(input.claimPath);
  assert.equal((await json(path.join(marker.directory, 'result.json'))).allCasesPassed, true);
});

test('abrupt process exit retains the started record and cannot resume the same claim', { timeout: 15000 }, async t => {
  const input = await fixture(t), script = path.join(input.root, 'crash.mjs');
  const module = new URL('../loredock-prepared-flow/coordinator.mjs', import.meta.url).href;
  await writeFile(script, `import {coordinateOrdinary,resourceCaseOrder} from ${JSON.stringify(module)};
    await coordinateOrdinary({...${JSON.stringify(input)},cases:resourceCaseOrder.map(id=>({id,requires:[],independentAfterFailure:true,run:async()=>process.exit(7)}))});`);
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(input.root, name + '.log'), 'wx', 0o600));
  const child = spawn(process.execPath, [script], { stdio: ['ignore', ...descriptors] }); descriptors.forEach(closeSync);
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exit; } });
  assert.deepEqual(await exit, { code: 7, signal: null });
  const events = (await readFile(path.join(input.directory, 'sequence.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(row => row.event), ['started', 'case-started']);
  assert.equal(events[1].id, resourceCaseOrder[0]);
  await assert.rejects(stat(path.join(input.directory, 'result.json')), error => error.code === 'ENOENT');
  let calls = 0;
  await assert.rejects(coordinateOrdinary({ ...input, directory: path.join(input.root, 'retry'), cases: cases(async () => { calls++; }) }), error => error.code === 'EEXIST');
  assert.equal(calls, 0);
});
