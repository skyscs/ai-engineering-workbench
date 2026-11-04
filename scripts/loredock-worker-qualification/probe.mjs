import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { workerCorpus } from '../../fixtures/loredock-worker-qualification/corpus.mjs';
import { runCompactQualification } from '../loredock-compact-qualification/coordinator.mjs';

// Single opt-in qualification. Ordinary tests never import this module or its corpus.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_WORKER_OUTPUT;
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), freezeCommit = '3d04283';
assert.ok(output && path.isAbsolute(output)); assert.equal(os.platform(), 'linux');
assert.equal(process.version, 'v22.23.2'); assert.equal(process.versions.v8, '12.4.254.21-node.56');
assert.ok(!process.env.NODE_OPTIONS && !process.execArgv.length, 'Use the pinned unmodified runtime.');
const inputs = {};
for (const name of ['corpus.mjs', 'oracle.json', 'preflight.json', 'baseline.json', 'README.md']) {
  const relative = 'fixtures/loredock-worker-qualification/' + name;
  inputs[name] = hash(await readFile(path.join(root, relative)));
  assert.equal(inputs[name], hash(execFileSync('git', ['show', freezeCommit + ':' + relative], { cwd: root })), 'Frozen input changed: ' + name);
}
const oracle = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-worker-qualification/oracle.json')));
const baseline = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-worker-qualification/baseline.json')));
for (const [name, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, name))), digest, 'Baseline changed: ' + name);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the measured entry point before observing the family.');
const implementationAcceptance = { head: '74b4a2f5136fc21949b57298eccc7add51202133', merge: '06028d76469942bd93d8fdfead8585621ec77fce',
  ci: { push: 41813105877, pullRequest: 41813113863 }, conclusion: 'Both exact-head events succeeded; merge tree verified identical before execution.' };
assert.equal(baseline.candidateImplementation, implementationAcceptance.head);
execFileSync('git', ['diff', '--exit-code', implementationAcceptance.head, implementationAcceptance.merge], { cwd: root });
execFileSync('git', ['merge-base', '--is-ancestor', implementationAcceptance.merge, 'HEAD'], { cwd: root });
const identity = { schemaVersion: 'task094-worker-qualification/1', freezeCommit, inputs, baseline, implementationAcceptance,
  candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), v8: process.versions.v8,
  hardware: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() } };
const report = await runCompactQualification({ root, output, oracle, corpusFactory: workerCorpus, identity,
  childArgs: (sizeRoot, arm, size) => [fileURLToPath(new URL('../loredock-streaming-qualification/child.mjs', import.meta.url)),
    sizeRoot, arm, fileURLToPath(new URL('./config.mjs', import.meta.url)), String(size.pathsPerSource)] });
console.log(JSON.stringify({ failed: report.failed, summary: report.summary, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
