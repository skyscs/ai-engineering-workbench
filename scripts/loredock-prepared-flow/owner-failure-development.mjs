// Deliberately abandon actual owned services to exercise the external kernel owner.
// Run only under kernel-owner.py. Ordinary permit sources; no model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, journal } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';
import { browser } from './browser.mjs';

const [output, mode] = process.argv.slice(2);
assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
assert(['driver-failure', 'external-interruption'].includes(mode));
await mkdir(output);
const corpus = corpusFactory();
for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
const sources = await materialize(path.join(output, 'sources'), corpus);
await save(path.join(output, 'sources.json'), sources);
const daemon = await launch({ directory: path.join(output, 'daemon'), data: path.join(output, 'data'), controlled: true });
const api = await client(path.join(output, 'http'));
await indexSources(api, sources.paths);
await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
const input = await prepare(api, question);
await generate(api, input.review);
const page = await browser({ directory: path.join(output, 'browser') });
await page.prepare(question);
const snapshot = await page.snapshot('before-failure');
assert(snapshot.text.includes('Saved prepared context'));
const controlled = await daemon.command('stats');
assert.equal(controlled.calls, 1);
const ready = journal(path.join(output, 'failure-ready.jsonl'));
ready.append({ mode, driverPid: process.pid, daemonPid: daemon.pid, controlled, modelCalls: 0, reservedFamilyReads: 0 });
ready.close();
// No local cleanup: a successful owner must discover, drain and reap the abandoned tree.
if (mode === 'driver-failure') process.exit(7);
await new Promise(() => {});
