import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuration } from './fixtures/qualification-assessment-config.js';
// @ts-expect-error Pure offline assessment; no measured corpus import.
import { assessArm, assessQualification } from '../../../scripts/loredock-qualification-assessment/assess.mjs';
// @ts-expect-error Pure versioned receipt codec.
import { canonical, hash, decodeReceipt } from '../../../scripts/loredock-qualification-assessment/codec.mjs';
// @ts-expect-error Bounded owned-artifact reader.
import { readArtifact } from '../../../scripts/loredock-qualification-assessment/artifact.mjs';
// @ts-expect-error Unchanged observation contract; no reserved corpus or resource run.
import { validateObservation } from '../../../scripts/loredock-streaming-qualification/validate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('../../../scripts/loredock-streaming-qualification/child.mjs', import.meta.url));
const configPath = fileURLToPath(new URL('./fixtures/qualification-assessment-config.ts', import.meta.url));
type RecordValue = Record<string, any>;
async function launch(folder: string, arm: string, caseId: number) {
  let stdout = '', stderr = '', timeout = false;
  const worker = spawn(process.execPath, ['--import', 'tsx', child, folder, arm, configPath, String(caseId)],
    { cwd: root, env: { PATH: process.env.PATH, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
  worker.stdout.on('data', chunk => { stdout += String(chunk); }); worker.stderr.on('data', chunk => { stderr += String(chunk); });
  const timer = setTimeout(() => { timeout = true; worker.kill('SIGKILL'); }, 60000);
  const outcome = await new Promise<RecordValue>(resolve => {
    let spawnError: string | undefined;
    worker.on('error', error => { spawnError = error.message; });
    worker.on('close', (exit, signal) => { clearTimeout(timer); resolve({ arm, exit, signal, timeout, spawnError }); });
  });
  await writeFile(path.join(folder, arm + '.stdout'), stdout); await writeFile(path.join(folder, arm + '.stderr'), stderr);
  await writeFile(path.join(folder, arm + '.exit.json'), JSON.stringify(outcome));
  assert.equal(outcome.exit, 0, stderr); assert.equal(outcome.timeout, false);
  return outcome;
}
const dimension = (value: RecordValue, name: string, key: string) => value.report.operations.find((row: RecordValue) => row.name === name).dimensions[key];
const row = (value: RecordValue, name: string) => value.raw.operations.find((item: RecordValue) => item.name === name);
async function replacement(input: RecordValue, name: string, label: string, bytes: Buffer | string) {
  const copy = structuredClone(input), ref = { file: `raw/mutated-${name}-${label}.json`, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
  await writeFile(path.join(input.root, ref.file), bytes); row(copy, name)[label] = ref; return copy;
}
function rehashProjection(p: RecordValue) {
  p.generationId = hash(JSON.stringify(p.identity)); const { projectionId: _id, ...body } = p; p.projectionId = hash(JSON.stringify(body));
}
function receiptBytes(value: RecordValue) {
  const { receiptHash: _hash, ...body } = value; return canonical({ ...body, receiptHash: hash(canonical(body)) });
}

test('offline assessment separates independent gates across real tiny child artifacts', { timeout: 180000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'qualification-assessment-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained assessment regression: ${folder}`); });
  const inputs: RecordValue[] = [], historyResources: RecordValue[] = [];
  for (const caseId of [0, 1]) {
    const run = path.join(folder, String(caseId)); await mkdir(run);
    const config = await configuration(caseId), assessed = [];
    for (const arm of ['same-process', 'reopened-process']) {
      const outcome = await launch(run, arm, caseId);
      const metadata = JSON.parse(await readFile(path.join(run, 'metadata.json'), 'utf8'));
      const raw = JSON.parse(await readFile(path.join(run, arm, 'result.json'), 'utf8'));
      const input = { root: path.join(run, arm), arm, raw, process: outcome, metadata,
        size: config.size, oracle: config.oracle, corpus: config.corpusFactory() };
      const value = await assessArm(input); assessed.push(value);
      await writeFile(path.join(run, arm + '.assessment.json'), JSON.stringify(value.report, null, 2));
      assert.equal(value.report.lifecycle.state, 'pass');
      let resourceFailures = 0;
      for (const operation of raw.operations) {
        validateObservation(operation, arm, config.oracle);
        for (const key of ['wallMs', 'maxSliceMs', 'peakRssMiB', 'heapGrowthMiB'])
          assert.ok(Number.isFinite(operation[key]) && operation[key] >= 0, `Invalid ${key} observation.`);
      }
      for (const operation of value.report.operations) for (const [name, result] of Object.entries(operation.dimensions)) {
        const state = (result as RecordValue).state;
        if (name === 'resources') {
          assert.ok(['pass', 'fail'].includes(state)); if (state === 'fail') resourceFailures++;
        } else assert.ok(['pass', 'not-applicable'].includes(state), JSON.stringify({ name, result }));
      }
      // Ordinary CI verifies scoring and lifecycle; preserve actual resource rejections.
      assert.equal(value.report.summary.resources.required, 8);
      assert.equal(value.report.summary.resources.fail, resourceFailures);
      assert.equal(value.report.summary.resources.pass, 8 - resourceFailures);
      assert.equal(value.report.failed, resourceFailures > 0);
      if (caseId === 0) { inputs.push(input); historyResources.push(dimension(value, 'history', 'resources')); }
      else {
        const positive = await configuration(0), rejected = await assessArm({ ...input, oracle: positive.oracle });
        assert.equal(rejected.report.failed, true);
        assert.equal(dimension(rejected, 'first', 'support').state, 'pass');
        assert.equal(dimension(rejected, 'first', 'usefulness').state, 'fail');
        assert.equal(dimension(rejected, 'history', 'history').state, 'pass');
      }
    }
    const combined = assessQualification(assessed);
    assert.equal(combined.parity.length, 7); assert.ok(combined.parity.every((item: RecordValue) => item.state === 'pass'));
    assert.equal(combined.failed, assessed.some(value => value.report.failed));
  }
  const first = inputs[0]!, other = inputs[1]!;
  await t.test('a damaged operation envelope preserves its independently valid receipt', async () => {
    const assessed = await assessArm(await replacement(first, 'first', 'artifact', '{'));
    assert.equal(assessed.report.failed, true);
    assert.equal(dimension(assessed, 'first', 'shape').state, 'fail');
    assert.equal(dimension(assessed, 'first', 'support').state, 'pass');
    assert.equal(dimension(assessed, 'history', 'history').state, 'pass');
    assert.equal(dimension(assessed, 'repeat-1', 'rawRepeat').state, 'pass');
    assert.equal(assessed.report.summary.usefulness.required, 7);
  });
  await t.test('false usefulness and support mismatch preserve repeats, history, resources and cross-process bytes', async () => {
    for (const kind of ['usefulness', 'support']) {
      const input = structuredClone(first);
      if (kind === 'usefulness') input.oracle.defaultOriginals++;
      else input.corpus['b-locker-api']['Reservations.java'] += '// Different frozen source.\n';
      const assessed = await assessArm(input), comparison = assessQualification([assessed, await assessArm(other)]);
      assert.equal(assessed.report.failed, true); assert.equal(comparison.failed, true);
      assert.equal(dimension(assessed, 'first', kind).state, 'fail');
      assert.equal(dimension(assessed, 'first', kind === 'usefulness' ? 'support' : 'usefulness').state, kind === 'usefulness' ? 'pass' : 'blocked');
      assert.equal(dimension(assessed, 'repeat-1', 'rawRepeat').state, 'pass');
      assert.equal(dimension(assessed, 'history', 'history').state, 'pass');
      assert.deepEqual(dimension(assessed, 'history', 'resources'), historyResources[0]);
      assert.ok(comparison.parity.every((item: RecordValue) => item.state === 'pass'));
      assert.equal(assessed.report.currentApplicability, 'not-evaluated');
    }
  });
  await t.test('missing, hash-invalid, malformed and unsupported first receipts report dependency reasons', async () => {
    for (const kind of ['missing', 'hash', 'json', 'version', 'utf8', 'duplicate']) {
      let input = structuredClone(first);
      if (kind === 'missing') row(input, 'first').receipt.file = 'raw/missing.json';
      else if (kind === 'hash') row(input, 'first').receipt.sha256 = '0'.repeat(64);
      else {
        const original = JSON.parse(await readFile(path.join(input.root, row(input, 'first').receipt.file), 'utf8'));
        original.schemaVersion = 'unsupported/2';
        const bytes = kind === 'json' ? '{' : kind === 'version' ? receiptBytes(original)
          : kind === 'utf8' ? Buffer.from([0xff]) : '{"receiptHash":' + JSON.stringify(original.receiptHash) + ','
            + (await readFile(path.join(input.root, row(input, 'first').receipt.file), 'utf8')).slice(1);
        input = await replacement(input, 'first', 'receipt', bytes);
      }
      const assessed = await assessArm(input);
      assert.equal(assessed.report.failed, true);
      assert.equal(dimension(assessed, 'history', 'history').reason, 'first-receipt-shape-unavailable');
      assert.equal(dimension(assessed, 'repeat-1', 'support').state, 'pass');
      assert.deepEqual(dimension(assessed, 'history', 'resources'), historyResources[0]);
      assert.equal(dimension(assessed, 'repeat-1', 'rawRepeat').state, ['missing', 'hash'].includes(kind) ? 'blocked' : 'fail');
      if (!['missing', 'hash'].includes(kind)) {
        // Identical opaque invalid receipts may pass byte equality, never shape or the overall gate.
        const mirrored = { ...input, arm: 'reopened-process', process: { ...input.process, arm: 'reopened-process' }, raw: { ...input.raw, arm: 'reopened-process' } };
        const parity = assessQualification([assessed, await assessArm(mirrored)]).parity;
        assert.equal(parity[0].state, 'pass'); assert.equal(parity[0].meaning, 'byte-equality-only');
      }
    }
  });
  await t.test('individually valid altered history records fail comparison without nested reads', async () => {
    for (const change of ['projection', 'original', 'dependency']) {
      const wrapper = JSON.parse(await readFile(path.join(first.root, row(first, 'history').artifact.file), 'utf8'));
      if (change === 'projection') { wrapper.result.projection.coverage.factEntries++; rehashProjection(wrapper.result.projection); }
      if (change === 'original') { const original = wrapper.result.originals[0]; original.text += ' changed'; original.spanHash = hash(original.text); }
      if (change === 'dependency') wrapper.result.dependencies[0].tree = 'f'.repeat(40);
      const assessed = await assessArm(await replacement(first, 'history', 'artifact', JSON.stringify(wrapper)));
      assert.equal(dimension(assessed, 'history', 'shape').state, 'pass');
      assert.equal(dimension(assessed, 'history', 'history').state, 'fail');
      assert.deepEqual(dimension(assessed, 'history', 'resources'), historyResources[0]);
      assert.equal(assessed.report.failed, true);
    }
  });
  await t.test('each sampled resource excess remains a failed overall gate despite valid content', async () => {
    for (const [key, maximum] of Object.entries({ wallMs: first.oracle.limits.wallMs,
      maxSliceMs: first.oracle.resources.maxSliceMs, peakRssMiB: first.oracle.resources.sampledRssMiB,
      heapGrowthMiB: first.oracle.resources.sampledHeapGrowthMiB })) {
      const input = structuredClone(first); row(input, 'history')[key] = Number(maximum) + 1;
      const assessed = await assessArm(input), resource = dimension(assessed, 'history', 'resources');
      assert.equal(resource.state, 'fail'); assert.ok(resource.error.message.includes(key));
      assert.equal(dimension(assessed, 'history', 'shape').state, 'pass');
      assert.equal(dimension(assessed, 'history', 'support').state, 'pass');
      assert.equal(dimension(assessed, 'history', 'history').state, 'pass');
      assert.equal(assessed.report.failed, true);
      const combined = assessQualification([assessed, await assessArm(other)]);
      assert.equal(combined.failed, true); assert.ok(combined.parity.every((item: RecordValue) => item.state === 'pass'));
    }
  });
  await t.test('resource and lifecycle errors cannot hide behind content success', async () => {
    for (const change of ['wall', 'nan', 'missing-counter', 'negative', 'nested-read', 'work', 'missing-output', 'child', 'watchdog', 'cleanup', 'missing-operation']) {
      const input = structuredClone(first), operation = row(input, 'history');
      if (change === 'wall') input.oracle.limits.wallMs = 0;
      if (change === 'nan') operation.peakRssMiB = NaN;
      if (change === 'missing-counter') { delete operation.before.gitCalls; delete operation.after.gitCalls; }
      if (change === 'negative') operation.metrics.textBytes = -1;
      if (change === 'nested-read') operation.after.pathReads++;
      if (change === 'work') { operation.metrics.pathWork = -1; operation.sums.path = -1; }
      if (change === 'missing-output') delete operation.metrics.spans;
      if (change === 'child') input.process.exit = 7;
      if (change === 'watchdog') input.process.timeout = true;
      if (change === 'cleanup') input.raw.errors.push({ phase: 'cleanup', message: 'Injected cleanup failure.' });
      if (change === 'missing-operation') input.raw.operations.pop();
      const assessed = await assessArm(input);
      assert.equal(assessed.report.failed, true, change);
      assert.equal(assessed.report.summary.usefulness.required, 7);
      assert.equal(dimension(assessed, 'first', 'support').state, 'pass');
      if (['child', 'watchdog', 'cleanup', 'missing-operation'].includes(change)) assert.equal(assessed.report.lifecycle.state, 'fail');
      else assert.equal(dimension(assessed, 'history', 'resources').state, 'fail');
    }
  });
  await t.test('codec refuses canonical mutations to identities, support, scope and graph', async () => {
    const original = JSON.parse(await readFile(path.join(first.root, row(first, 'first').receipt.file), 'utf8'));
    for (const change of ['duplicate-original', 'duplicate-projection-key', 'unknown-endpoint', 'unknown-evidence', 'accounting', 'topic', 'range', 'oversize-text', 'depth']) {
      const receipt = structuredClone(original), projection = JSON.parse(receipt.projectionJson);
      if (change === 'duplicate-original') receipt.originals[1] = receipt.originals[0];
      if (change === 'unknown-endpoint') projection.graph.edges[0].to = 'absent';
      if (change === 'unknown-evidence') projection.graph.nodes[0].evidenceIds = ['absent'];
      if (change === 'accounting') projection.identity.accounting.version = 'unknown/2';
      if (change === 'topic') projection.identity.topicRule.version = 'unknown/2';
      if (change === 'range') Object.values<RecordValue>(projection.graph.evidence)[0]!.startLine = -1;
      if (change === 'oversize-text') { receipt.originals[0].text = 'x'.repeat(65537); receipt.originals[0].spanHash = hash(receipt.originals[0].text); }
      if (change === 'depth') { let node = projection.coverage; for (let i = 0; i < 45; i++) node = node.deep = {}; }
      rehashProjection(projection); receipt.projectionJson = JSON.stringify(projection);
      if (change === 'duplicate-projection-key') receipt.projectionJson = '{"schemaVersion":' + JSON.stringify(projection.schemaVersion)
        + ',' + receipt.projectionJson.slice(1);
      // The outer projection is a string, so depth is checked when its content is decoded.
      assert.throws(() => decodeReceipt(Buffer.from(receiptBytes(receipt))), change);
    }
  });
  passed = true;
});

test('artifact boundary rejects traversal, symlinks, non-files and invalid bounds before parsing', async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'qualification-artifact-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(path.join(folder, 'raw')); const bytes = Buffer.from('{}');
  await writeFile(path.join(folder, 'raw/valid.json'), bytes); await mkdir(path.join(folder, 'raw/directory.json'));
  await symlink(path.join(folder, 'raw/valid.json'), path.join(folder, 'raw/link.json'));
  const valid = { file: 'raw/valid.json', bytes: bytes.length, sha256: hash(bytes) };
  assert.deepEqual(await readArtifact(folder, valid), bytes);
  for (const ref of [{ ...valid, file: '../outside.json' }, { ...valid, file: '/etc/passwd' }, { ...valid, file: 'raw/link.json' },
    { ...valid, file: 'raw/directory.json' }, { ...valid, bytes: 1400000 }, { ...valid, bytes: -1 }, { ...valid, bytes: 1 },
    { ...valid, sha256: '0'.repeat(64) }]) await assert.rejects(readArtifact(folder, ref));
  const alias = path.join(folder, 'alias'); await symlink(folder, alias); await assert.rejects(readArtifact(alias, valid));
  const nested = path.join(folder, 'nested'); await mkdir(nested); await symlink(path.join(folder, 'raw'), path.join(nested, 'raw'));
  await assert.rejects(readArtifact(nested, valid));
});
