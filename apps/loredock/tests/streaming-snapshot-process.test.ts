import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './fixtures/allocation-profile-config.js';
// @ts-expect-error Independent receipt/observation validation, with no frozen inputs or probe.
import { validateReceipt, validateObservation, validateProjection } from '../../../scripts/loredock-memory-attribution/validate.mjs';

const execute = promisify(execFile), hash = (value: string) => createHash('sha256').update(value).digest('hex');
const child = fileURLToPath(new URL('../../../scripts/loredock-memory-runner/child.mjs', import.meta.url));
const cwd = fileURLToPath(new URL('../', import.meta.url));
const oracle = { ...config.oracle, selectedRequiredNodes: config.oracle.requiredNodes, selectedFlows: 1,
  isolatedOriginals: 5, isolated: { reason: 'unresolved-import' } };
const names = ['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history'];
interface Artifact { file: string; bytes: number; sha256: string }
interface Operation { name: string; artifact: Artifact; receipt?: Artifact; sums: { path: number; receipt: number } }
interface Report { pid: number; errors: unknown[]; operations: Operation[]; initialHashes: unknown; evicted: string }

test('streaming and baseline processes preserve complete capture bytes, shared work and evicted history', { timeout: 210000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'streaming-capture-regression-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained streaming process regression: ${root}`); });
  const baseline = new Map<string, { text: string; sums: Operation['sums'] }>(), pids = new Set<number>();
  for (const arm of config.oracle.arms) {
    // Candidate prepares/captures in its long-lived process; the baseline reads an identical stopped copy.
    const configuration = fileURLToPath(new URL(arm === 'reopened-process'
      ? './fixtures/memory-runner-config.ts' : './fixtures/streaming-snapshot-config.ts', import.meta.url));
    let exit;
    try {
      exit = { code: 0, signal: null, ...await execute(process.execPath, ['--import', 'tsx', child, root, arm, configuration],
        { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }) };
    } catch (cause) {
      const error = cause as { code: number | string; signal: string | null; stdout: string; stderr: string };
      exit = { code: error.code, signal: error.signal, stdout: error.stdout, stderr: error.stderr };
    }
    await writeFile(path.join(root, arm + '.exit.json'), JSON.stringify(exit, null, 2));
    assert.equal(exit.code, 0, JSON.stringify(exit)); assert.equal(exit.signal, null);
    const folder = path.join(root, arm), report: Report = JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8'));
    const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8'));
    assert.deepEqual(report.errors, []); assert.deepEqual(report.initialHashes, metadata.initialHashes);
    assert.equal(report.evicted, metadata.inventory.id); assert.deepEqual(report.operations.map(row => row.name), names);
    pids.add(report.pid);
    const artifact = async (ref: Artifact) => {
      const text = await readFile(path.join(folder, ref.file), 'utf8');
      assert.equal(Buffer.byteLength(text), ref.bytes); assert.equal(hash(text), ref.sha256); return text;
    };
    let firstReceipt: string | undefined, firstProjection: string | undefined;
    for (const row of report.operations) {
      validateObservation(row, arm, config.oracle);
      const raw = JSON.parse(await artifact(row.artifact)); assert.equal(raw.error, null); assert.equal(raw.observerError, null);
      let text: string;
      if (row.receipt) {
        text = await artifact(row.receipt);
        const value = validateReceipt(text, row.name, oracle, config.size, config.corpusFactory(), metadata);
        if (row.name === 'first') { firstReceipt = text; firstProjection = value.receipt.projectionJson; }
        if (row.name.startsWith('repeat-')) assert.equal(text, firstReceipt);
      } else {
        validateProjection(raw.result.projection); text = JSON.stringify(raw.result.projection);
        if (row.name === 'history') { assert.equal(raw.result.status, 'recorded'); assert.equal(text, firstProjection); }
        else { assert.equal(row.name, 'page-4'); assert.equal(raw.result.projection.roots.offset, 4); assert.equal(raw.result.projection.roots.items.length, 1); }
      }
      if (arm === 'same-process') baseline.set(row.name, { text, sums: row.sums });
      else assert.deepEqual({ text, sums: row.sums }, baseline.get(row.name), arm + '/' + row.name);
    }
  }
  assert.equal(pids.size, 3); assert.equal(baseline.size, 8); passed = true;
});
