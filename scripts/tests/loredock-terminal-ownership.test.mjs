import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, stat, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runOwnedChild } from '../loredock-terminal-ownership/process.mjs';
import { readSnapshot } from '../loredock-terminal-ownership/read.mjs';
import { summarizeSnapshot } from '../loredock-terminal-ownership/graph.mjs';
import { limitsFor } from '../loredock-terminal-ownership/limits.mjs';

const script = fileURLToPath(new URL('./fixtures/terminal-ownership-child.mjs', import.meta.url));
const selectors = [{ label: 'owned fixture', name: 'TerminalOwnedFixture', properties: { tag: 'terminal-owned-fixture/1' } }];
const hash = value => createHash('sha256').update(value).digest('hex');

test('real terminal exports distinguish held and released objects outside any application operation', { timeout: 60000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-ownership-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained terminal regression: ${root}`); });
  const output = path.join(root, 'worker'), result = await runOwnedChild({ script, output, limits: { watchdogMs: 15000 } });
  assert.equal(result.failed, false, JSON.stringify(result));
  assert.equal(result.resourceAcceptance, false);
  assert.deepEqual((await readdir(output)).filter(file => file.endsWith('.heapsnapshot')).sort(),
    ['after-history.heapsnapshot', 'after-release.heapsnapshot']);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'exit.json'), 'utf8')), result);
  const values = [];
  for (const stage of ['after-history', 'after-release']) {
    const record = JSON.parse(await readFile(path.join(output, stage + '.json'), 'utf8'));
    assert.equal(record.backendCollection, true); assert.equal(record.resourceAcceptance, false);
    const bytes = await readSnapshot(output, record), value = summarizeSnapshot(bytes, selectors);
    await writeFile(path.join(output, stage + '.summary.json'), JSON.stringify(value, null, 2));
    assert.equal(value.resourceAcceptance, false); values.push(value);
    if (stage === 'after-history') {
      // Use this real pinned metadata with an independent three-owner graph below.
      await t.test('graph validation preserves weak and runtime uncertainty and rejects malformed indices', () => {
        const actual = JSON.parse(bytes), strings = ['', 'TerminalOwnedFixture', 'held', 'weak', 'runtime', 'tag', 'terminal-owned-fixture/1'];
        const fixture = { snapshot: { meta: actual.snapshot.meta, node_count: 5, edge_count: 6, trace_function_count: 0 },
          // Root -> three owners; every owner shares the same marker string.
          nodes: [9, 0, 1, 0, 3, 0, 0, 3, 1, 3, 24, 1, 0, 0, 3, 1, 5, 24, 1, 0, 0,
            3, 1, 7, 24, 1, 0, 0, 2, 6, 9, 32, 0, 0, 0],
          edges: [2, 2, 7, 6, 3, 14, 3, 4, 21, 2, 5, 28, 2, 5, 28, 2, 5, 28],
          trace_function_infos: [], trace_tree: [], samples: [], locations: [], strings };
        const encode = value => Buffer.from(JSON.stringify(value));
        const summary = summarizeSnapshot(encode(fixture), selectors);
        assert.equal(summary.groups[0].count, 3); assert.equal(summary.groups[0].shallowBytes, 72);
        assert.deepEqual(summary.groups[0].examples.map(item => item.path.state),
          ['explicit-strong-edges', 'no-nonweak-path-found', 'runtime-edges-unclassified']);
        assert.equal(summary.weakEdges, 1);
        const native = structuredClone(fixture); native.nodes[7] = 8; native.edges[11] = 14;
        const nativeResult = summarizeSnapshot(encode(native), selectors);
        assert.equal(nativeResult.groups[0].examples[0].path.state, 'runtime-edges-unclassified');
        for (const mutation of ['schema', 'id', 'node-kind', 'negative-size', 'target-alignment', 'target-range', 'string', 'edge-kind', 'edge-count', 'locations', 'traces']) {
          const value = structuredClone(fixture);
          if (mutation === 'schema') value.snapshot.meta.node_fields[0] = 'unknown';
          if (mutation === 'id') value.nodes[9] = value.nodes[2];
          if (mutation === 'node-kind') value.nodes[7] = 100;
          if (mutation === 'negative-size') value.nodes[10] = -1;
          if (mutation === 'target-alignment') value.edges[2] = 8;
          if (mutation === 'target-range') value.edges[2] = 7000;
          if (mutation === 'string') value.edges[1] = 100;
          if (mutation === 'edge-kind') value.edges[0] = 9;
          if (mutation === 'edge-count') value.nodes[4]++;
          if (mutation === 'locations') value.locations = [99, 1, 1, 1];
          if (mutation === 'traces') value.trace_tree = [1];
          assert.throws(() => summarizeSnapshot(encode(value), selectors), mutation);
        }
        assert.throws(() => summarizeSnapshot(encode(fixture), selectors, { nodes: 4 }));
        assert.throws(() => summarizeSnapshot(encode(fixture), selectors, { summaryBytes: 1 }));
        assert.throws(() => summarizeSnapshot(Buffer.from([0xff]), selectors));
        assert.throws(() => summarizeSnapshot(Buffer.from('{'), selectors));
        assert.throws(() => limitsFor({ fileBytes: Infinity })); assert.throws(() => limitsFor({ unknown: 1 }));
      });
    }
  }
  assert.equal(values[0].groups[0].count, 1); assert.equal(values[1].groups[0].count, 0);
  assert.ok(values[0].groups[0].examples[0].path.edges.length > 0);
  passed = true;
});

test('owned child boundary preserves exits, cancellation, watchdog and hard file-size failures', { timeout: 20000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-process-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained terminal process failures: ${root}`); });
  for (const mode of ['fail', 'cleanup', 'watchdog', 'cancelled', 'rss', 'oversize']) {
    const output = path.join(root, mode), controller = new AbortController();
    const timer = mode === 'cancelled' ? setTimeout(() => controller.abort(), 30) : undefined;
    const limits = { watchdogMs: 5000, ...(mode === 'watchdog' ? { watchdogMs: 30 } : mode === 'rss' ? { sampledRssBytes: 1 }
      : mode === 'oversize' ? { fileBytes: 524288 } : {}) };
    const result = await runOwnedChild({ script, output, args: [['watchdog', 'cancelled', 'rss'].includes(mode) ? 'hang' : mode], limits, signal: controller.signal });
    clearTimeout(timer); assert.equal(result.failed, true, mode);
    assert.deepEqual(JSON.parse(await readFile(path.join(output, 'exit.json'), 'utf8')), result);
    if (mode === 'fail' || mode === 'cleanup') {
      assert.equal(result.exit, mode === 'fail' ? 7 : 8); assert.match(await readFile(path.join(output, 'stderr.log'), 'utf8'), /Independent.*failure/);
    } else if (mode === 'oversize') assert.ok((await stat(path.join(output, 'oversized.bin'))).size <= limits.fileBytes);
    else assert.equal(result.stopped, mode === 'rss' ? 'sampled-rss-limit' : mode);
  }
  passed = true;
});

test('snapshot file boundary refuses wrong hashes, bounds, paths and symlinks', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-file-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('{}'), ref = { file: 'after-history.heapsnapshot', bytes: bytes.length, sha256: hash(bytes) };
  await writeFile(path.join(root, ref.file), bytes); assert.deepEqual(await readSnapshot(root, ref), bytes);
  await symlink(path.join(root, ref.file), path.join(root, 'after-release.heapsnapshot'));
  for (const invalid of [{ ...ref, file: '../outside' }, { ...ref, file: 'after-release.heapsnapshot' }, { ...ref, bytes: 1 },
    { ...ref, bytes: 1024 * 1024 * 1024 }, { ...ref, sha256: '0'.repeat(64) }]) await assert.rejects(readSnapshot(root, invalid));
});
