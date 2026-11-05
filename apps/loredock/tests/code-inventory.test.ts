import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { readMapDocument } from '../src/map-document.js';
import { typescriptFacts } from '../src/code-typescript.js';
import { javaFacts } from '../src/code-java.js';
import { codeFlows } from '../src/code-flows.js';
import { declarationMap } from '../src/system-map.js';
import { codeAnalysisFingerprint } from '../src/code-analysis-facts.js';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Test-only exact loading delta; the original experiment verifier remains strict.
import { beforeCompilerLoading } from './fixtures/compiler-loading-reference/verify.mjs';
// @ts-expect-error Owned workload generation is plain JavaScript.
import { createCapacityFixture } from '../../../scripts/loredock-capacity-fixture.mjs';
// @ts-expect-error The offline experiment is plain JavaScript.
import { codeFactRanges, scanCodeInventory, verifyCodeInventoryContract, inventoryLimits } from '../../../scripts/loredock-code-inventory.mjs';
// @ts-expect-error The offline coverage comparison is plain JavaScript.
import { inspectInventoryCoverage } from '../../../scripts/loredock-code-inventory-probe.mjs';

test('code fact offsets preserve UTF-16 source ranges and reject detached operations or invalid spans', () => {
  const content = '// 😀 source prefix\nexport function amber() { return fetch("/amber"); }\n';
  const facts = typescriptFacts(content, 'src/amber.ts'), ranges = codeFactRanges(content, facts);
  assert.equal(ranges.offsetEncoding, 'UTF-16 code units'); assert.equal(ranges.symbols[0].startLine, 2);
  assert.equal(ranges.operations[0].startLine, 2); assert.equal(ranges.symbols[0].endLine, 2);
  const corrupt = structuredClone(facts); corrupt.symbols[0]!.end = content.length + 1;
  assert.throws(() => codeFactRanges(content, corrupt), /Invalid parser source range/);
  const detached = structuredClone(facts); detached.operations[0]!.owner = 'unissued';
  assert.throws(() => codeFactRanges(content, detached), /Unknown operation owner/);
});

test('full small-shape inventory repeats facts, exposes budget omissions and fences damaged or revoked originals', async t => {
  await assert.rejects(verifyCodeInventoryContract(), /Frozen inventory input changed: apps\/loredock\/src\/code-typescript.ts/);
  const root = new URL('../../../', import.meta.url);
  const frozen = JSON.parse(await readFile(new URL('fixtures/loredock-code-inventory/baseline.json', root), 'utf8')) as {
    sourceHashes: Record<string, string>; parserFingerprint: string; limits: unknown;
  };
  for (const [file, expected] of Object.entries(frozen.sourceHashes))
    assert.equal(sha256(await beforeCompilerLoading(file, await readFile(new URL(file, root))) as Buffer), expected, file);
  assert.deepEqual(inventoryLimits, frozen.limits);
  const parserFingerprint = codeAnalysisFingerprint(); assert.notEqual(parserFingerprint, frozen.parserFingerprint);
  const fixture = await createCapacityFixture(1);
  const store = new CatalogStore(path.join(fixture.root, 'inventory-data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  const paths = fixture.manifest.sources.map((source: { id: string }) => path.join(fixture.root, 'sources', source.id));
  const preview = await catalog.previewSources(paths); await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'inventory' });
  const state = catalog.state(); catalog.start('inventory', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const services = { readMapDocument, typescriptFacts, javaFacts }, gitTexts = new Map(), buildId = catalog.readBuild().id;
  const scan = (limits = {}) => scanCodeInventory(services, catalog, fixture, parserFingerprint, { limits, gitTexts, buildId });
  const first = await scan(), second = await scan();
  assert.equal(first.summary.candidates, 41); assert.equal(first.summary.retained, 41); assert.equal(first.summary.failed, 0);
  assert.deepEqual(second.records, first.records); assert.ok(first.verifiedSpans >= 41);
  const coverage = inspectInventoryCoverage(first, codeFlows(catalog), declarationMap(catalog), fixture.probes);
  assert.deepEqual(coverage.missingDefaultSymbols, []); assert.equal(coverage.exactSymbols.filter((row: { found: boolean }) => row.found).length, 3);
  const bounded = await scan({ documents: 1 }); assert.equal(bounded.summary.examined, 1); assert.equal(bounded.summary.unattempted, 40);
  assert.equal((await scan({ fileBytes: 0 })).summary.excluded, 41);
  assert.equal((await scan({ fileSpans: 0 })).summary.excluded, 41);
  assert.equal((await scan({ textBytes: 0 })).summary.unattempted, 41);
  assert.equal((await scan({ wallMs: 0 })).summary.unattempted, 41);
  const outputBound = await scan({ factBytes: 0 }); assert.equal(outputBound.factBytes, 0); assert.equal(outputBound.summary.factsOmitted, 1);
  assert.equal(outputBound.summary.unattempted, 40);
  assert.equal((await scan({ fileFactBytes: 0, documents: 1 })).summary.factsOmitted, 1);
  const chosen = first.records[0], source = catalog.state().sources.find(source => source.name === chosen.source)!;
  const file = store.one<{ id: string; contentHash: string }>('SELECT id,contentHash FROM files WHERE sourceId=? AND path=?', source.id, chosen.path)!;
  store.run("UPDATE files SET contentHash='damaged' WHERE id=?", file.id);
  const damaged = await scan({ documents: 1 }); assert.equal(damaged.summary.failed, 1); assert.equal(damaged.records[0].facts, undefined);
  store.run('UPDATE files SET contentHash=? WHERE id=?', file.contentHash, file.id);
  catalog.revoke(source.id); const removed = await scan();
  assert.ok(removed.records.every((row: { source: string }) => row.source !== source.name));
  const nextSource = catalog.state().sources.find(source => source.status === 'active')!; let changed = false;
  await assert.rejects(scanCodeInventory({ ...services, typescriptFacts: (content: string, filePath: string) => {
    const facts = typescriptFacts(content, filePath);
    if (!changed) { changed = true; catalog.revoke(nextSource.id); }
    return facts;
  } }, catalog, fixture, frozen.parserFingerprint, { limits: { documents: 1 }, buildId }), /Source authorization changed/);
  catalog.updatePolicy(['src']); await assert.rejects(scan(), /old policy/);
  assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
});
