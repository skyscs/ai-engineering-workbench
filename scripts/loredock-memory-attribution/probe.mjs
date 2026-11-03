import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { attributionCorpus } from '../../fixtures/loredock-memory-attribution/corpus.mjs';
import { hash } from '../loredock-capture-memory/fixture.mjs';
import { runAttribution } from './coordinator.mjs';
import { validateReceipt } from './validate.mjs';

// Opt-in one-run entry point. Ordinary CI never imports this module or its frozen corpus.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_MEMORY_ATTRIBUTION_OUTPUT;
assert.ok(output && path.isAbsolute(output)); assert.equal(process.version, 'v22.23.2');
assert.ok(!process.env.NODE_OPTIONS && !process.execArgv.length, 'Use the declared unmodified Node runtime.');
const inputs = {};
for (const name of ['corpus.mjs', 'oracle.json', 'preflight.json', 'README.md']) {
  const relative = 'fixtures/loredock-memory-attribution/' + name;
  inputs[name] = hash(await readFile(path.join(root, relative)));
  assert.equal(inputs[name], hash(execFileSync('git', ['show', '3663114:' + relative], { cwd: root })), 'Frozen input changed: ' + name);
}
const oracle = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-memory-attribution/oracle.json')));
const baseline = JSON.parse(await readFile(new URL('./baseline.json', import.meta.url)));
for (const [name, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, name))), digest);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the candidate before observing it.');
const identity = { schemaVersion: 'task079-memory-attribution/1', freezeCommit: '3663114',
  candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), inputs, baseline,
  hardware: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() } };
const report = await runAttribution({ root, output, oracle, corpusFactory: attributionCorpus, identity, validateReceipt,
  childArgs: (sizeRoot, arm, size) => [fileURLToPath(new URL('../loredock-memory-runner/child.mjs', import.meta.url)), sizeRoot, arm,
    fileURLToPath(new URL(size.pathsPerSource === 28 ? './small.mjs' : './large.mjs', import.meta.url))] });
console.log(JSON.stringify(report.summary)); process.exitCode = report.failed ? 1 : 0;
