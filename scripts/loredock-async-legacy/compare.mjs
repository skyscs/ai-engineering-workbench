import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { Corrections } from '../../apps/loredock/dist/corrections.js';
import { Reconciliation } from '../../apps/loredock/dist/reconciliation.js';
import { projectionObservation, savedObservation } from './observe.mjs';
import { plan } from './plan.mjs';

const [baseline, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
for (const value of [baseline, output]) assert(path.isAbsolute(value ?? '') && path.resolve(value) === value);
await mkdir(output);
const result = { cases: [], accounting: [], errors: [], resourceQualification: false, modelCalls: 0 };
let store, catalog;
try {
  for (const name of plan.order) {
    const source = path.join(baseline, name), directory = path.join(output, name);
    await mkdir(directory); await cp(path.join(source, 'data'), path.join(directory, 'data'), { recursive: true, errorOnExist: true, force: false });
    const expected = JSON.parse(await readFile(path.join(source, 'expected.json'), 'utf8'));
    store = new CatalogStore(path.join(directory, 'data')); catalog = new Catalog(store);
    if (name.startsWith('saved-')) {
      const observed = await savedObservation(catalog);
      await writeFile(path.join(directory, 'observed.json'), JSON.stringify(observed, null, 2) + '\n', { flag: 'wx' });
      assert.equal(observed.length, expected.length);
      for (let index = 0; index < observed.length; index++) {
        const { lexical: before, ...old } = expected[index], { lexical: after, ...current } = observed[index];
        assert.equal(JSON.stringify(current), JSON.stringify(old));
        for (const key of ['originalReads', 'originalBytes', 'rejectedUnits']) assert.equal(after[key], before[key]);
        assert(after.sqlRows >= before.sqlRows);
        assert.equal(after.acceptedUnits - before.acceptedUnits, after.sqlRows - before.sqlRows);
        result.accounting.push({ name, id: current.detail.id, before, after });
      }
    } else {
      const observed = await projectionObservation(catalog);
      const { correctionRequests = [], reapplications = [], ...projection } = expected;
      await writeFile(path.join(directory, 'observed.json'), JSON.stringify(observed, null, 2) + '\n', { flag: 'wx' });
      assert.equal(JSON.stringify(observed), JSON.stringify(projection));
      for (const { input, output } of correctionRequests) assert.equal(JSON.stringify(await new Corrections(catalog).save(input)), JSON.stringify(output));
      for (const { input, output } of reapplications) assert.equal(JSON.stringify(await new Reconciliation(catalog).reapply(input)), JSON.stringify(output));
    }
    result.cases.push(name); await catalog.stop(); catalog = undefined; store.close(); store = undefined;
  }
} catch (error) { result.errors.push({ name: error.name, message: error.message, stack: error.stack }); process.exitCode = 1; }
finally {
  if (catalog) await catalog.stop(); if (store) store.close();
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ cases: result.cases, accountingRows: result.accounting.length, errors: result.errors }, null, 2));
