// Static authoring verification only: never import or execute the application on this family.
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { corpusFactory, variants } from './corpus.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = 'fixtures/loredock-prepared-flow/';
const sha = value => createHash('sha256').update(value).digest('hex');
const raw = file => readFile(path.join(root, file));
const json = async file => JSON.parse(await raw(file));
const base = '0985f2cdde4ddd6221330c8bbb02e389e8cc65fe';
const protocol = await json(directory + 'protocol.json'), oracle = await json(directory + 'oracle.json');
assert.equal(protocol.family, 'kiln-prepared-flow-127');
assert.equal(new Set(protocol.resourceCases.map(row => row.id)).size, 15);
assert.equal(new Set(oracle.cases.map(row => row.id)).size, 10);
assert.equal(protocol.semanticBudget.attempts, oracle.cases.length);
assert.equal(protocol.semanticBudget.automaticRetries, 0);
const inputs = {}, summary = {}, corpora = new Map();
for (const variant of variants) {
  const corpus = corpusFactory(variant), vector = [];
  corpora.set(variant, corpus);
  assert.equal(Object.keys(corpus).length, 20);
  for (const source of Object.keys(corpus).sort()) {
    const files = corpus[source];
    assert.equal(Object.keys(files).length, variant === 'near-limit' ? 500 : 12);
    for (const file of Object.keys(files).sort()) {
      assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
      const bytes = Buffer.from(files[file]);
      assert(bytes.length > 0 && bytes.length < 32768);
      assert(!/[\u0400-\u04ff]/u.test(files[file]));
      vector.push({ source, path: file, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  const totalBytes = vector.reduce((sum, file) => sum + file.bytes, 0);
  assert(totalBytes < 50 * 1024 * 1024);
  inputs[variant] = vector;
  summary[variant] = { sources: 20, files: vector.length, bytes: totalBytes,
    eligibleCodeExtensions: vector.filter(file => /\.(ts|js|vue|java)$/.test(file.path)).length,
    orderedVectorSha256: sha(JSON.stringify(vector)) };
  assert.deepEqual(corpusFactory(variant), corpus, 'Data-only factory must be deterministic.');
}
const quoteRanges = {};
for (const [id, reference] of Object.entries(oracle.references)) {
  const variant = reference.variant ?? 'representative';
  const text = corpora.get(variant)?.[reference.source]?.[reference.path];
  assert.equal(typeof text, 'string', id);
  const at = text.indexOf(reference.quote);
  assert(at >= 0 && text.indexOf(reference.quote, at + 1) === -1, id + ' must identify one exact original quote.');
  const startLine = text.slice(0, at).split('\n').length;
  quoteRanges[id] = { variant, source: reference.source, path: reference.path,
    startLine, endLine: startLine + reference.quote.split('\n').length - 1,
    quoteSha256: sha(reference.quote), fileSha256: sha(text) };
}
for (const row of oracle.cases) {
  assert(variants.includes(row.variant));
  assert(Buffer.byteLength(row.question) > 0 && Buffer.byteLength(row.question) <= 2000);
  assert(row.requiredPropositions.length && row.requiredOriginals.length);
  for (const id of row.requiredOriginals) {
    const reference = oracle.references[id]; assert(reference, row.id + ':' + id);
    assert(corpora.get(row.variant)[reference.source]?.[reference.path]?.includes(reference.quote), row.id + ':' + id);
  }
}
const auditPath = 'docs/fixtures/loredock-prepared-question-http-ui/runtime-audit.json';
const audit = await json(auditPath);
assert.equal(process.version, audit.node);
assert.equal(process.versions.v8, audit.v8);
const runtime = {};
for (const [file, expected] of Object.entries(audit.daemonWorkspaceImports)) {
  runtime[file] = sha(await raw(file)); assert.equal(runtime[file], expected, file);
}
const externalEntries = {};
for (const [name, expected] of Object.entries(audit.externalEntryPoints)) {
  const bytes = await raw(expected.entry);
  assert.equal(sha(bytes), expected.sha256, name);
  externalEntries[name] = expected;
}
for (const [file, expected] of Object.entries(audit.browser)) {
  const bytes = await raw(file);
  assert.equal(bytes.length, expected.bytes, file); assert.equal(sha(bytes), expected.sha256, file);
}
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const sourceFiles = tracked.filter(file => /^(apps|packages)\/[^/]+\/src\//.test(file)
  || /(^|\/)package\.json$/.test(file) || ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.nvmrc', '.node-version'].includes(file));
const application = {};
for (const file of sourceFiles) application[file] = sha(await raw(file));
const normative = [directory + 'corpus.mjs', directory + 'oracle.json', directory + 'protocol.json', directory + 'seal.mjs',
  'docs/loredock/PREPARED_FLOW_QUALIFICATION.md', 'tasks/128-loredock-prepared-flow-resource-qualification.md'];
const frozenFiles = {};
for (const file of normative) frozenFiles[file] = sha(await raw(file));
const vectors = Buffer.from(JSON.stringify(inputs) + '\n');
const vectorArchive = directory + 'source-vectors.json.gz';
const make = process.argv.slice(2).join(' ') === '--write';
assert(make || process.argv.length === 2, 'Use no arguments to verify, or --write once to create the input seal.');
const snapshot = {
  schemaVersion: 'prepared-flow-input-freeze/1', statusAtFreeze: 'reserved-unobserved', base,
  acceptedHead: '480764db70d21ba86011bd5f55ac307a662e1b2e', pushCi: 41951325641, pullRequestCi: 41951520368,
  treeEqualityVerified: true, candidateFamilyReads: 0, modelCalls: 0,
  node: process.version, v8: process.versions.v8, parserFingerprint: audit.fingerprint,
  variants: summary, quoteRanges, frozenFiles, application, runtime, externalEntries, browser: audit.browser,
  acceptedRuntimeAudit: { path: auditPath, sha256: sha(await raw(auditPath)) },
  vectorArchive: { path: vectorArchive, uncompressedBytes: vectors.length, uncompressedSha256: sha(vectors) },
  scope: 'Accepted emitted workspace closure, external entry points plus lock/package bindings and built browser assets. No recursive external-internal audit, future driver seal, Chrome identity, observed resource result or model qualification.'
};
if (make) {
  for (const file of [directory + 'freeze.json', vectorArchive]) {
    await access(path.join(root, file)).then(() => { throw new Error('Refuse to overwrite existing input seal: ' + file); }, error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  const archive = gzipSync(vectors, { level: 9 });
  assert.deepEqual(gunzipSync(archive), vectors);
  snapshot.vectorArchive.sha256 = sha(archive);
  await writeFile(path.join(root, vectorArchive), archive, { flag: 'wx' });
  await writeFile(path.join(root, directory + 'freeze.json'), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
} else {
  const archive = await raw(vectorArchive); assert.deepEqual(gunzipSync(archive), vectors);
  snapshot.vectorArchive.sha256 = sha(archive);
  assert.deepEqual(await json(directory + 'freeze.json'), snapshot);
}
console.log(JSON.stringify({ action: make ? 'sealed' : 'verified', variants: summary, quoteReferences: Object.keys(quoteRanges).length,
  semanticCases: oracle.cases.length, resourceCases: protocol.resourceCases.length, applicationFiles: sourceFiles.length,
  emittedWorkspaceModules: Object.keys(runtime).length, browserAssets: Object.keys(audit.browser).length,
  candidateFamilyReads: 0, modelCalls: 0 }, null, 2));
