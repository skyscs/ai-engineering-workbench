import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transportCases, transportPlan } from './plan.mjs';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { codeFlows } from '../../apps/loredock/dist/code-flows.js';
import { typescriptFacts } from '../../apps/loredock/dist/code-typescript.js';
import { withLegacyFileParser } from '../../apps/loredock/dist/legacy-file-parser.js';
import { OwnedFileParser } from '../../apps/loredock/dist/file-parser.js';
import { fileParserDigest, fileParserProtocol } from '../../apps/loredock/dist/file-parser-protocol.js';

const root = path.resolve(process.argv[2]);
await mkdir(root); // Exclusive first attempt; never reset retained input.
assert.equal(process.versions.node, transportPlan.node);
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
const errorRecord = error => ({ name: error.name, code: error.code ?? null, message: error.message });
await writeFile(path.join(root, 'plan.json'), json(transportPlan), { flag: 'wx' });
const rows = [];
for (const input of transportCases) {
  const directory = path.join(root, input.id), source = path.join(directory, 'source');
  await mkdir(path.join(source, 'src'), { recursive: true });
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'user.name=LoreDock Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { cwd: source, encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1',
      LC_ALL: 'C', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } }).trimEnd();
  await mkdir(path.join(directory, 'empty-template'));
  git(['init', '--quiet', '--object-format=sha1', '--initial-branch=main', '--template=' + path.join(directory, 'empty-template')]);
  await writeFile(path.join(source, input.path), input.content, { flag: 'wx' });
  await writeFile(path.join(source, 'README.md'), '# Parser compatibility control\n\nSynthetic HTTP functions for transport compatibility.\n', { flag: 'wx' });
  git(['add', '--all']); git(['commit', '--quiet', '-m', 'Add synthetic parser compatibility control']);
  const row = { id: input.id, input: { path: input.path, bytes: input.bytes, sha256: input.sha256, revision: git(['rev-parse', 'HEAD']) },
    direct: null, threaded: null, owner: null, errors: [] };
  rows.push(row);
  const store = new CatalogStore(path.join(directory, 'data')), catalog = new Catalog(store), owner = new OwnedFileParser();
  try {
    await catalog.addSource(source);
    const state = catalog.state(); catalog.start('control', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    assert(catalog.state().publishedBuildId);
    assert(input.bytes <= transportPlan.inputBytes);
    const facts = typescriptFacts(input.content, input.path), serialized = JSON.stringify(facts);
    const direct = await codeFlows(catalog), graph = JSON.stringify(direct);
    assert(direct.nodes.some(node => node.label === 'useful'));
    assert(direct.nodes.some(node => node.kind === 'http-request'));
    await writeFile(path.join(directory, 'direct-facts.json'), serialized, { flag: 'wx' });
    await writeFile(path.join(directory, 'direct-graph.json'), graph, { flag: 'wx' });
    row.direct = { factsBytes: Buffer.byteLength(serialized), factsHash: hash(serialized), graphBytes: Buffer.byteLength(graph), graphHash: hash(graph),
      symbols: facts.symbols.length, operations: facts.operations.length, gaps: facts.gaps, coverage: direct.coverage, omissions: direct.omissions,
      replyBytes: Buffer.byteLength(JSON.stringify({ version: fileParserProtocol, generation: '0'.repeat(36), identity: '0'.repeat(64),
        id: 1, digest: fileParserDigest(input.path, input.content), type: 'facts', facts })) };
    const deadline = performance.now() + transportPlan.operationMs;
    await owner.start({ deadline });
    try {
      const threaded = await withLegacyFileParser(value => owner.parse(value.path, value.content, { deadline }), () => codeFlows(catalog));
      const serialized = JSON.stringify(threaded);
      await writeFile(path.join(directory, 'threaded-graph.json'), serialized, { flag: 'wx' });
      row.threaded = { exact: serialized === graph, graphHash: hash(serialized), graphBytes: Buffer.byteLength(serialized) };
      if (serialized !== graph) row.errors.push({ code: 'GRAPH_MISMATCH', message: 'The owned parser changed successful graph bytes.' });
    } catch (error) { row.errors.push(errorRecord(error)); }
  } catch (error) { row.errors.push(errorRecord(error)); }
  finally {
    try { await owner.stop(); } catch (error) { row.errors.push(errorRecord(error)); }
    row.owner = owner.snapshot();
    await catalog.stop(); store.close();
    assert.equal(git(['status', '--porcelain=v1']), '');
    await writeFile(path.join(directory, 'result.json'), json(row), { flag: 'wx' });
  }
}
const result = { plan: transportPlan.schemaVersion, cases: rows, compatible: rows.every(row => row.threaded?.exact && !row.errors.length && !row.owner.owned),
  modelCalls: 0, resourceQualification: false, productionChanges: false };
await writeFile(path.join(root, 'result.json'), json(result), { flag: 'wx' });
console.log(json({ compatible: result.compatible, cases: rows.map(row => ({ id: row.id, direct: row.direct, threaded: row.threaded, errors: row.errors, owner: row.owner })) }));
if (!result.compatible) process.exitCode = 1;
