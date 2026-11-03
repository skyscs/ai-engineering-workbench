import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { hash } from '../loredock-capture-memory/fixture.mjs';
import { allocationCorpus } from '../../fixtures/loredock-allocation-profile/corpus.mjs';
import { runProfile } from './coordinator.mjs';
import { loadProfileOracle } from './inputs.mjs';

// Opt-in frozen profile. Never import from ordinary tests.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_ALLOCATION_PROFILE_OUTPUT;
assert.ok(output && path.isAbsolute(output)); assert.equal(process.version, 'v22.23.2');
assert.ok(!process.env.NODE_OPTIONS && process.execArgv.length === 0);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '');
const inputs = {};
for (const name of ['corpus.mjs', 'oracle.json', 'preflight.json', 'README.md']) {
  const relative = 'fixtures/loredock-allocation-profile/' + name;
  inputs[name] = hash(await readFile(path.join(root, relative)));
  assert.equal(inputs[name], hash(execFileSync('git', ['show', 'c34cece:' + relative], { cwd: root })));
}
for (const name of ['PROTOCOL_REVISION_2.md', 'profile-policy.json']) {
  const relative = 'fixtures/loredock-allocation-profile/' + name;
  inputs[name] = hash(await readFile(path.join(root, relative)));
  assert.equal(inputs[name], hash(execFileSync('git', ['show', '59ef02b:' + relative], { cwd: root })));
}
const baseline = JSON.parse(await readFile(new URL('./baseline.json', import.meta.url)));
for (const [name, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, name))), digest);
const oracle = await loadProfileOracle();
const report = await runProfile({ root, output, oracle, corpusFactory: allocationCorpus,
  identity: { schemaVersion: 'task080-allocation-profile/2', repositoryRoot: root, freezeCommit: 'c34cece', protocolRevisionCommit: '59ef02b', inputs, baseline,
    candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    hardware: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() } },
  childArgs: (output, role) => [fileURLToPath(new URL('./child.mjs', import.meta.url)), output, role, fileURLToPath(new URL('./config.mjs', import.meta.url))] });
console.log(JSON.stringify({ failed: report.failed, integrity: report.integrity, profile: report.profile, resourceAcceptance: report.resourceAcceptance }));
process.exitCode = report.failed ? 1 : 0;
