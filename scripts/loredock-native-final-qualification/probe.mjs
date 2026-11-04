import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runtimeIdentity } from '../loredock-native-qualification/runtime.mjs';
import { runNativeQualification } from '../loredock-native-qualification/coordinator.mjs';
import { configuration } from './config.mjs';

// One opt-in reserved attempt. Never imported by ordinary checks or smoke tests.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_NATIVE_FINAL_OUTPUT;
const freezeCommit = '688b082f4e705c8a9d648ad69fa2b68da5925bca';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); assert.equal(os.platform(), 'linux');
assert.ok(!process.env.NODE_OPTIONS && process.execArgv.length === 0, 'Use the pinned unmodified runtime.');
const inputs = {};
for (const relative of ['README.md', 'corpus.mjs', 'oracle.json', 'preflight.json', 'baseline.json'].map(name => 'fixtures/loredock-native-final-qualification/' + name)
  .concat('scripts/loredock-native-final-qualification/config.mjs')) {
  const bytes = await readFile(path.join(root, relative)); inputs[relative] = hash(bytes);
  assert.equal(hash(execFileSync('git', ['show', freezeCommit + ':' + relative], { cwd: root })), inputs[relative], 'Frozen input changed: ' + relative);
}
const baseline = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-native-final-qualification/baseline.json')));
assert.equal(process.version, baseline.node.version); assert.equal(process.versions.v8, baseline.node.v8);
const binary = createHash('sha256'); for await (const chunk of createReadStream(process.execPath)) binary.update(chunk);
assert.equal(binary.digest('hex'), baseline.node.sha256);
const require = createRequire(path.join(root, 'apps/loredock/package.json'));
assert.equal(require('typescript').version, baseline.typescript.version); assert.equal(hash(await readFile(require.resolve('typescript'))), baseline.typescript.sha256);
assert.equal(execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(), baseline.pnpm);
for (const [file, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, file))), digest, 'Baseline changed: ' + file);
assert.deepEqual(await runtimeIdentity(), baseline.runtime);
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the measured entry point first.');
const acceptance = JSON.parse(await readFile(new URL('./acceptance.json', import.meta.url)));
assert.equal(baseline.candidateImplementation, acceptance.head);
assert.equal(acceptance.ci.push.conclusion, 'success'); assert.equal(acceptance.ci.pullRequest.conclusion, 'success');
for (const value of Object.values(acceptance.ci)) assert.equal(value.head, acceptance.head);
execFileSync('git', ['diff', '--exit-code', acceptance.head, acceptance.merge], { cwd: root });
execFileSync('git', ['merge-base', '--is-ancestor', acceptance.merge, 'HEAD'], { cwd: root });
const config = await configuration(499);
const identity = { schemaVersion: 'task110-native-final-qualification/1', freezeCommit, inputs, baseline, acceptance,
  measuredCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  hardware: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() } };
await mkdir(output); await writeFile(path.join(output, 'identity.json'), JSON.stringify(identity, null, 2));
const report = await runNativeQualification({ output: path.join(output, 'run'), config, caseId: 499, watchdogs: config.watchdogs,
  configuration: fileURLToPath(new URL('./config.mjs', import.meta.url)) });
const result = { schemaVersion: 'task110-native-final-result/1', failed: report.summary.failed, summary: report.summary, errors: report.errors,
  resourceQualification: true, modelRequests: 0, identity: 'identity.json', rawReport: 'run/result.json' };
await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
process.exitCode = result.failed ? 1 : 0;
