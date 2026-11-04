import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runNativeQualification } from '../loredock-native-qualification/coordinator.mjs';
import { configuration } from '../loredock-native-qualification/development.mjs';
import { assessNativeArm, combineNativeArms, validateLimits } from '../loredock-native-qualification/assessment.mjs';
import { readJSON } from '../loredock-native-qualification/io.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), configPath = fileURLToPath(new URL('../loredock-native-qualification/development.mjs', import.meta.url));
const badChild = fileURLToPath(new URL('./fixtures/native-driver-child.mjs', import.meta.url));
// The normal check runs tests before the application build. Compile this actual
// entry point once; children must not install a tsx loader or source-service facade.
before(() => {
  const require = createRequire(path.join(root, 'apps/loredock/package.json'));
  execFileSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '-p', path.join(root, 'apps/loredock/tsconfig.json')], { cwd: root, timeout: 60000, stdio: 'pipe' });
});
async function execute(t, caseId = 0, extras = {}) {
  const parent = await mkdtemp(path.join(tmpdir(), 'native-driver-')); let passed = false;
  t.after(async () => { if (passed) await rm(parent, { recursive: true, force: true }); else t.diagnostic(`Retained native driver regression: ${parent}`); });
  const config = configuration(caseId === 1 ? 1 : 0), output = path.join(parent, 'run');
  const report = await runNativeQualification({ output, config, configuration: configPath, caseId, ...(caseId >= 2 ? { child: badChild } : {}), ...extras });
  assert.deepEqual(await readJSON(path.join(output, 'result.json')), report);
  return { report, output, config, pass: () => { passed = true; } };
}

test('compiled native children preserve all sixteen functional operations and seven raw comparisons', { timeout: 120000 }, async t => {
  const { report, output, config, pass } = await execute(t);
  assert.equal(report.summary.functionalFailed, false, JSON.stringify(report));
  assert.equal(report.summary.plannedOperations, 16); assert.equal(report.summary.requiredComparisons, 7);
  assert.ok(report.summary.parity.every(item => item.state === 'pass')); assert.equal(report.processes.length, 2);
  assert.notEqual(report.processes[0].pid, report.processes[1].pid); assert.deepEqual(report.errors, []);
  let failures = 0; const inputs = [], assessments = [], metadata = await readJSON(path.join(output, 'metadata.json'));
  assert.ok(Object.keys(metadata.runtime.modules).length > 20); assert.match(metadata.runtime.typescript, /^[a-f0-9]{64}$/);
  for (const arm of report.arms) {
    assert.equal(arm.artifactError, null); assert.equal(arm.assessment.content.failed, false); assert.equal(arm.assessment.complete.failed, false);
    assert.equal(arm.assessment.lifecycle.state, 'pass'); assert.equal(arm.assessment.content.summary.usefulness.required, 7);
    assert.equal(arm.assessment.content.summary.history.pass, 1);
    for (const row of arm.assessment.observations) { assert.equal(row.observation.state, 'pass'); if (row.resource.state === 'fail') failures++; }
    const input = { root: path.join(output, arm.arm), arm: arm.arm, raw: await readJSON(path.join(output, arm.arm, 'result.json')),
      outcome: report.processes.find(row => row.arm === arm.arm), metadata, config };
    assert.deepEqual(input.raw.execArgv, []); assert.equal(input.raw.operations.length, 8);
    inputs.push(input); assessments.push(await assessNativeArm(input));
  }
  assert.equal(report.summary.failed, failures > 0); assert.equal(report.resourceQualification, false);
  await t.test('zero resource ceiling preserves content, no-write, history and parity while failing every resource gate', async () => {
    const reduced = { ...config, oracle: { ...config.oracle, resources: { ...config.oracle.resources, sampledRssMiB: 0 } } };
    const values = await Promise.all(inputs.map(input => assessNativeArm({ ...input, config: reduced }))), combined = combineNativeArms(values);
    assert.equal(combined.failed, true); assert.equal(combined.functionalFailed, false); assert.ok(combined.parity.every(row => row.state === 'pass'));
    assert.equal(values.flatMap(value => value.report.observations).filter(row => row.resource.state === 'fail').length, 16);
  });
  await t.test('missing work, nested history reads, snapshot identities and closure failures cannot disappear behind raw parity', async () => {
    for (const mode of ['metric', 'counter', 'nested', 'source-write', 'missing-operation', 'runtime', 'snapshot', 'identity', 'cleanup', 'closure', 'child', 'watchdog']) {
      const input = structuredClone(inputs[0]), history = input.raw.operations.at(-1);
      if (mode === 'metric') delete history.metrics.spans;
      if (mode === 'counter') delete history.before.originalReads;
      if (mode === 'nested') history.after.factReads++;
      if (mode === 'source-write') history.after.changedRows++;
      if (mode === 'missing-operation') input.raw.operations.pop();
      if (mode === 'runtime') input.raw.runtime.typescript = 'a'.repeat(64);
      if (mode === 'snapshot') input.raw.initialHashes = {};
      if (mode === 'identity') input.metadata.catalogId = '33333333-3333-4333-8333-333333333333';
      if (mode === 'cleanup') input.raw.errors.push({ phase: 'cleanup', message: 'Injected failed closure.' });
      if (mode === 'closure') input.raw.lifecycle = input.raw.lifecycle.filter(row => row.stage !== 'closure-after');
      if (mode === 'child') input.outcome.exit = 9;
      if (mode === 'watchdog') input.outcome.timeout = true;
      const value = await assessNativeArm(input), combined = combineNativeArms([value, assessments[1]]);
      assert.equal(value.report.functionalFailed, true, mode); assert.equal(combined.failed, true, mode);
      assert.equal(combined.plannedOperations, 16); assert.equal(combined.requiredComparisons, 7);
      assert.ok(combined.parity.every(row => row.state === 'pass'), mode);
    }
    assert.throws(() => validateLimits({ ...config.oracle, limits: { ...config.oracle.limits, wallMs: 5001 } }));
  });
  pass();
});

test('actual compiled incomplete consumer preserves its gap and cannot satisfy a complete-path oracle', { timeout: 120000 }, async t => {
  const { report, output, config, pass } = await execute(t, 1);
  assert.equal(report.summary.functionalFailed, false, JSON.stringify(report));
  const complete = configuration(0), metadata = await readJSON(path.join(output, 'metadata.json'));
  const assessment = await assessNativeArm({ root: path.join(output, 'same-process'), arm: 'same-process', outcome: report.processes[0], metadata,
    raw: await readJSON(path.join(output, 'same-process/result.json')), config: { ...config, oracle: complete.oracle, complete: complete.complete } });
  assert.equal(assessment.report.complete.failed, true); assert.equal(assessment.report.content.operations[0].dimensions.support.state, 'pass');
  assert.equal(assessment.report.functionalFailed, true); pass();
});

for (const [name, mode] of [['cleanup', 2], ['malformed report', 3], ['changed snapshot', 4], ['failed child', 5], ['watchdog', 6]])
  test('native coordinator retains failure and denominators for ' + name, { timeout: 120000 }, async t => {
    const extras = mode === 6 ? { watchdogs: { preparer: 100, reader: 100, overall: 5000, grace: 100 } } : {};
    const { report, output, pass } = await execute(t, mode, extras);
    assert.equal(report.summary.failed, true); assert.equal(report.summary.functionalFailed, true);
    assert.equal(report.summary.plannedOperations, 16); assert.equal(report.summary.requiredComparisons, 7);
    if (mode === 2) for (const arm of report.arms) { assert.equal(arm.assessment.content.failed, false); assert.equal(arm.assessment.lifecycle.state, 'fail'); }
    if (mode === 3) assert.ok(report.arms.every(arm => arm.artifactError));
    if (mode === 4) { assert.ok(report.processes[1].blocked); assert.equal(report.arms[0].assessment.functionalFailed, false); }
    if (mode === 5) { assert.equal(report.processes[0].exit, 7); assert.match(await readFile(path.join(output, 'same-process.stderr'), 'utf8'), /Injected native child exit/); }
    if (mode === 6) { assert.equal(report.processes[0].timeout, true); assert.ok(['SIGKILL', 'SIGTERM'].includes(report.processes[0].signal)); }
    pass();
  });

test('coordinator cancellation terminates the owned child and retains blocked required observations', { timeout: 30000 }, async t => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 250);
  t.after(() => clearTimeout(timer));
  const { report, pass } = await execute(t, 6, { signal: controller.signal, watchdogs: { grace: 100 } });
  assert.equal(report.summary.functionalFailed, true); assert.equal(report.summary.plannedOperations, 16); assert.equal(report.summary.requiredComparisons, 7);
  assert.ok(report.processes[1].blocked); pass();
});

test('worker report boundary rejects symlinks, oversized regular files and malformed UTF-8', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-driver-io-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'valid.json'); await writeFile(file, '{}'); assert.deepEqual(await readJSON(file), {});
  const link = path.join(directory, 'link.json'); await symlink(file, link); await assert.rejects(readJSON(link));
  const other = path.join(directory, 'directory.json'); await mkdir(other); await assert.rejects(readJSON(other));
  await writeFile(file, ' '.repeat(1048577)); await assert.rejects(readJSON(file));
  await writeFile(file, Buffer.from([0xff])); await assert.rejects(readJSON(file));
});
