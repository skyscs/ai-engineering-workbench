import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { terminalCorpus } from '../../fixtures/loredock-terminal-memory/corpus.mjs';
import { runTerminalDiagnostic } from './coordinator.mjs';

// Opt-in single frozen observation. Never imported by ordinary tests.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_TERMINAL_OUTPUT;
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), freezeCommit = '5fc0900';
assert.ok(output && path.isAbsolute(output)); assert.equal(os.platform(), 'linux');
assert.equal(process.version, 'v22.23.2'); assert.equal(process.versions.v8, '12.4.254.21-node.56');
assert.ok(!process.env.NODE_OPTIONS && !process.execArgv.length, 'Use the declared unmodified runtime.');
const inputs = {};
for (const name of ['corpus.mjs', 'oracle.json', 'preflight.json', 'baseline.json', 'README.md']) {
  const relative = 'fixtures/loredock-terminal-memory/' + name;
  inputs[name] = hash(await readFile(path.join(root, relative)));
  assert.equal(inputs[name], hash(execFileSync('git', ['show', freezeCommit + ':' + relative], { cwd: root })), 'Frozen input changed: ' + name);
}
const oracle = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-terminal-memory/oracle.json')));
const baseline = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-terminal-memory/baseline.json')));
for (const [name, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, name))), digest, 'Baseline changed: ' + name);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the measured entry point before observation.');
const identity = { freezeCommit, candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), inputs, baseline,
  hardware: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() } };
const report = await runTerminalDiagnostic({ output,
  childScript: fileURLToPath(new URL('./child.mjs', import.meta.url)),
  childArgs: [fileURLToPath(new URL('./config.mjs', import.meta.url)), '496'],
  oracle, size: oracle.sizes[0], corpusFactory: () => terminalCorpus(496), selectors: oracle.selectors, terminalLimits: oracle.terminal, identity });
console.log(JSON.stringify({ failed: report.failed, diagnosticComplete: report.diagnosticComplete,
  completePaths: report.completePaths, assessment: report.assessment?.summary, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
