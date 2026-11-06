import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { losslessPlan } from './plan.mjs';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { codeFlows } from '../../apps/loredock/dist/code-flows.js';
import { factRanges } from '../../apps/loredock/dist/code-analysis-facts.js';
import { withLegacyFileParser } from '../../apps/loredock/dist/legacy-file-parser.js';
import { OwnedFileParser } from '../../apps/loredock/dist/file-parser.js';
import { encodeParserReply, fileParserDigest, fileParserProtocol } from '../../apps/loredock/dist/file-parser-protocol.js';

const root = path.resolve(process.argv[2]), original = path.resolve(process.argv[3]);
await mkdir(root); assert.equal(process.versions.node, losslessPlan.node);
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const errorRecord = error => ({ name: error.name, code: error.code ?? null, message: error.message });
const before = JSON.parse(await readFile(path.join(original, 'run/result.json'), 'utf8'));
assert.deepEqual(before.cases.map(row => row.id), losslessPlan.cases);
await writeFile(path.join(root, 'plan.json'), json(losslessPlan), { flag: 'wx' });
const rows = [];
for (const expected of before.cases) {
  const directory = path.join(root, expected.id), source = path.join(original, 'run', expected.id);
  await mkdir(path.join(directory, 'data'), { recursive: true });
  await copyFile(path.join(source, 'data/loredock.db'), path.join(directory, 'data/loredock.db'));
  const content = await readFile(path.join(source, 'source', expected.input.path), 'utf8');
  const serialized = await readFile(path.join(source, 'direct-facts.json'), 'utf8'), graph = await readFile(path.join(source, 'direct-graph.json'), 'utf8');
  assert.equal(hash(content), expected.input.sha256); assert.equal(hash(serialized), expected.direct.factsHash); assert.equal(hash(graph), expected.direct.graphHash);
  const row = { id: expected.id, input: expected.input, before: expected.direct, facts: null, graph: null, owner: null, errors: [] }; rows.push(row);
  const store = new CatalogStore(path.join(directory, 'data')), catalog = new Catalog(store), owner = new OwnedFileParser();
  try {
    const deadline = performance.now() + losslessPlan.operationMs; await owner.start({ deadline });
    const actual = await owner.parse(expected.input.path, content, { deadline }), text = JSON.stringify(actual);
    assert.equal(text, serialized); assert.deepEqual(factRanges(content, actual), factRanges(content, JSON.parse(serialized)));
    const encoded = encodeParserReply({ version: fileParserProtocol, generation: owner.generation, identity: '0'.repeat(64),
      type: 'facts', id: 1, digest: fileParserDigest(expected.input.path, content), facts: actual });
    row.facts = { exact: true, bytes: Buffer.byteLength(text), sha256: hash(text), encodedReplyBytes: encoded.byteLength };
    await writeFile(path.join(directory, 'facts.json'), text, { flag: 'wx' });
    const projected = await withLegacyFileParser(value => owner.parse(value.path, value.content, { deadline }), () => codeFlows(catalog));
    const observed = JSON.stringify(projected); assert.equal(observed, graph);
    row.graph = { exact: true, bytes: Buffer.byteLength(observed), sha256: hash(observed) };
    await writeFile(path.join(directory, 'graph.json'), observed, { flag: 'wx' });
  } catch (error) { row.errors.push(errorRecord(error)); }
  finally {
    try { await owner.stop(); } catch (error) { row.errors.push(errorRecord(error)); }
    row.owner = owner.snapshot(); await catalog.stop(); store.close();
    await writeFile(path.join(directory, 'result.json'), json(row), { flag: 'wx' });
  }
}
const compatible = rows.every(row => row.facts?.exact && row.graph?.exact && !row.errors.length && !row.owner.owned);
await writeFile(path.join(root, 'result.json'), json({ cases: rows, compatible, modelCalls: 0, resourceQualification: false }), { flag: 'wx' });
console.log(json({ compatible, cases: rows })); if (!compatible) process.exitCode = 1;
