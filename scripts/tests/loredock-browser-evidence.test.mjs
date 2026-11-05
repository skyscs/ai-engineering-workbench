import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { browserBody } from '../loredock-prepared-flow/browser-evidence.mjs';
import { assessBrowserApi, assessRecordedBrowser } from '../loredock-prepared-flow/browser-assess.mjs';
import { hash } from '../loredock-prepared-flow/io.mjs';

const url = 'http://127.0.0.1:4244/api/answers', id = '100.1';
function fixture(seconds = 0.5) {
  const raw = '{ "attempts": [] }\n', body = browserBody({ body: raw, base64Encoded: false }, url);
  const protocol = (method, params) => ({ event: 'protocol', value: { method, params: { requestId: id, ...params } } });
  const events = [protocol('Network.requestWillBeSent', { timestamp: 10, request: { url, method: 'GET' } }),
    protocol('Network.responseReceived', { response: { status: 200 } }),
    protocol('Network.loadingFinished', { timestamp: 10 + seconds }),
    { event: 'api-body', requestId: id, file: 'raw-response-' + hash(id) + '.json', ...body.metadata }];
  return { events, readBody: async () => body.retained, raw };
}
test('browser bodies preserve exact Unicode/whitespace bytes and redact only session payloads', () => {
  const text = '{ "text": "café ☕", "token": "synthetic-source-value" }\n';
  for (const base64Encoded of [false, true]) {
    const result = browserBody({ body: base64Encoded ? Buffer.from(text).toString('base64') : text, base64Encoded }, url);
    assert.equal(result.retained.toString(), text); assert.equal(result.metadata.bytes, Buffer.byteLength(text));
    assert.equal(result.metadata.rawSha256, hash(text)); assert.equal(result.metadata.redacted, false);
  }
  const session = browserBody({ body: '{"token":"owned-test-secret"}', base64Encoded: false }, 'http://127.0.0.1:4244/api/session');
  assert(!session.retained.toString().includes('owned-test-secret')); assert.equal(session.metadata.rawSha256, null);
  assert.equal(JSON.parse(session.retained).token, '[removed-session-token]');
  assert.throws(() => browserBody({ body: Buffer.from([255]).toString('base64'), base64Encoded: true }, url));
});
test('browser API checks use original bytes and inclusive resource latency without qualifying fault timing', async () => {
  const passing = await assessBrowserApi({ ...fixture(), lane: 'resource' });
  assert.equal(passing.http.status, 'passed'); assert.equal(passing.http.observations[0].elapsedMs, 500);
  const failing = await assessBrowserApi({ ...fixture(0.501), lane: 'resource' }); assert.equal(failing.http.status, 'failed');
  const fault = await assessBrowserApi({ ...fixture(0.501), lane: 'fault' });
  assert.equal(fault.http.status, 'observed'); assert.equal(fault.http.timingQualified, false); assert.equal(fault.resourceQualification, false);
});
test('parsed-only legacy bodies, missing terminals and failed browser requests remain incomplete', async () => {
  for (const omitted of ['api-body', 'Network.loadingFinished']) {
    const input = fixture(); input.events = input.events.filter(row => (row.value?.method ?? row.event) !== omitted);
    assert.equal((await assessBrowserApi({ ...input, lane: 'resource' })).http.status, 'incomplete');
  }
  const failed = fixture(); failed.events[2].value.method = 'Network.loadingFailed'; failed.events.pop();
  assert.equal((await assessBrowserApi({ ...failed, lane: 'resource' })).http.status, 'incomplete');
});
test('browser evidence rejects changed body bytes, duplicate identities and unobserved body records', async () => {
  await assert.rejects(assessBrowserApi({ ...fixture(), readBody: async () => Buffer.from('{}'), lane: 'resource' }));
  const duplicate = fixture(); duplicate.events.push(duplicate.events[3]);
  await assert.rejects(assessBrowserApi({ ...duplicate, lane: 'resource' }));
  const orphan = fixture(); orphan.events[3].requestId = 'other';
  await assert.rejects(assessBrowserApi({ ...orphan, lane: 'resource' }));
});
test('recorded browser assessment keeps memory exceedances and incomplete observation failures', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-browser-evidence-'));
  t.diagnostic('Retained browser-evidence test: ' + root);
  const directory = path.join(root, 'browser'), processDirectory = path.join(root, 'daemon');
  await mkdir(directory); await mkdir(processDirectory);
  const json = async (where, name, value) => writeFile(path.join(where, name), JSON.stringify(value) + '\n');
  await json(processDirectory, 'process.json', { controlled: false, fault: false, accounting: false });
  await json(processDirectory, 'exit.json', { code: 0, signal: null, spawnError: null });
  await json(directory, 'process.json', { pid: 1 });
  const input = fixture(), events = [{ event: 'idle-window-start', name: 'history-20', now: 100, milliseconds: 30000 },
    ...input.events, { event: 'idle-window-end', name: 'history-20', now: 30100 }];
  await writeFile(path.join(directory, 'events.jsonl'), events.map(JSON.stringify).join('\n') + '\n');
  await writeFile(path.join(directory, input.events[3].file), input.raw);
  await json(directory, 'history-20-window.json', { name: 'history-20', elapsedMs: 30000, apiRequests: 1 });
  const paint = { started: 10, painted: 20, duration: 10, visible: true };
  const observation = { longTasks: [{ startTime: 0, duration: 200 }], actions: [paint], updates: [paint], pendingPaints: 0 };
  await json(directory, 'observation.json', observation);
  const rss = 1073741824, row = { pid: 1, rssBytes: rss, complete: true, issues: [], startedTicks: '1', userTicks: '1', systemTicks: '1' };
  const samples = [0, 100].map(began => ({ began, at: began + 1, rssBytes: rss, complete: true, rows: [row] }));
  const writeSamples = () => writeFile(path.join(directory, 'process-tree.jsonl'), samples.map(JSON.stringify).join('\n') + '\n');
  await writeSamples();
  const exit = { code: 0, signal: null, sampleError: null, errors: [], memorySamples: 2, incompleteMemorySamples: 0, maxRssBytes: rss,
    lifetime: { reason: 'completed', driverExit: { exit: 0 }, errors: [], survivors: [] } };
  await json(directory, 'exit.json', exit);
  const assess = () => assessRecordedBrowser({ directory, processDirectory, lane: 'resource' });
  assert.equal((await assess()).status, 'passed');
  samples[1].began = 101; samples[1].at = 102; await writeSamples();
  assert((await assess()).checks.some(check => check.metric === 'browserSampleGapMs' && !check.passed));
  samples[1].began = 100; samples[1].at = 101; await writeSamples();
  row.rssBytes++; for (const sample of samples) sample.rssBytes++;
  exit.maxRssBytes++; await writeSamples(); await json(directory, 'exit.json', exit);
  assert.equal((await assess()).status, 'failed');
  samples[0].complete = false; exit.incompleteMemorySamples = 1;
  await writeSamples(); await json(directory, 'exit.json', exit); assert.equal((await assess()).status, 'incomplete');
  samples[0].complete = true; exit.incompleteMemorySamples = 0; await writeSamples(); await json(directory, 'exit.json', exit);
  observation.pendingPaints = 1; await json(directory, 'observation.json', observation); assert.equal((await assess()).status, 'incomplete');
});
