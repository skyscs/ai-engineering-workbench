import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { Corrections } from '../../apps/loredock/dist/corrections.js';
import { Reconciliation } from '../../apps/loredock/dist/reconciliation.js';
import { projectionObservation, savedObservation } from '../loredock-async-legacy/observe.mjs';

const directory = new URL('../../docs/fixtures/loredock-async-legacy/baseline/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

test('awaitable consumers preserve fresh frozen graphs, reviews, contexts, prompts and saved v1/v2 bytes', async t => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const root = await mkdtemp(path.join(tmpdir(), 'async-legacy-parity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function original(name) {
    const entry = manifest.files.find(row => row.path === name); assert(entry);
    const compressed = await readFile(new URL(name, directory)); assert.equal(hash(compressed), entry.gzipSha256);
    const raw = gunzipSync(compressed); assert.equal(raw.length, entry.bytes); assert.equal(hash(raw), entry.sha256); return raw;
  }
  for (const name of manifest.plan.order) await t.test(name, async () => {
    const data = path.join(root, name); await mkdir(data);
    await writeFile(path.join(data, 'loredock.db'), await original(name + '/loredock.db.gz'), { flag: 'wx' });
    const expected = JSON.parse((await original(name + '/expected.json.gz')).toString());
    const store = new CatalogStore(data), catalog = new Catalog(store);
    try {
      if (name.startsWith('saved-')) {
        const observed = await savedObservation(catalog); assert.equal(observed.length, expected.length);
        for (let index = 0; index < observed.length; index++) {
          const { lexical: before, ...old } = expected[index], { lexical: after, ...current } = observed[index];
          assert.equal(JSON.stringify(current), JSON.stringify(old));
          assert.equal(after.originalBytes, before.originalBytes); assert.equal(after.originalReads, before.originalReads);
          assert.equal(after.rejectedUnits, 0); assert(after.sqlRows > before.sqlRows);
          assert.equal(after.acceptedUnits - before.acceptedUnits, after.sqlRows - before.sqlRows);
        }
      } else {
        const { correctionRequests = [], reapplications = [], ...old } = expected;
        assert.equal(JSON.stringify(await projectionObservation(catalog)), JSON.stringify(old));
        for (const { input, output } of correctionRequests) assert.equal(JSON.stringify(await new Corrections(catalog).save(input)), JSON.stringify(output));
        for (const { input, output } of reapplications) assert.equal(JSON.stringify(await new Reconciliation(catalog).reapply(input)), JSON.stringify(output));
      }
    } finally { await catalog.stop(); store.close(); }
  });
});
