// Reassess retained ordinary bytes only. No candidate services or new preparations.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { assessPreview } from './assess.mjs';
import { save, hash, inventory, normalized } from './io.mjs';

const output = process.argv[2], input = process.argv[3];
assert(process.argv.length === 4 && [output, input].every(value => path.isAbsolute(value ?? '') && path.resolve(value) === value));
await mkdir(output);
const report = { errors: [], cases: [], candidatePreparations: 0, modelCalls: 0, reservedFamilyReads: 0, qualification: false,
  input, assessment: 'Offline correction of the independent omission-field reader; original run outcomes remain unchanged.' };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const before = await inventory(input);
try {
  const original = await json(path.join(input, 'result.json'));
  assert.equal(original.cases.length, 10);
  for (const row of original.cases) {
    assert(/^D\d\d-[a-z-]+$/.test(row.id));
    const directory = path.join(input, row.id), source = await json(path.join(directory, 'sources.json'));
    const { expected, references, engineerNote } = await json(path.join(directory, 'oracle.json'));
    assert.equal(expected.id, row.id); assert.equal(row.preparations, 1);
    const corpus = {};
    for (const file of source.originals) {
      assert(!path.isAbsolute(file.path) && !file.path.split('/').includes('..') && /^[a-z0-9-]+$/.test(file.source));
      const raw = await readFile(path.join(directory, 'sources', file.source, file.path));
      assert.equal(hash(raw), file.sha256); assert.equal(raw.length, file.bytes);
      (corpus[file.source] ??= {})[file.path] = raw.toString('utf8');
    }
    const result = { id: row.id, errors: [], originalErrors: row.errors, reviewSha256: hash(JSON.stringify(row.review)) };
    report.cases.push(result);
    try { result.assessment = assessPreview(row.review, { corpus, sources: source, expected, references, engineerNote }); }
    catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { assert.deepEqual(await inventory(input), before); report.rawInputTreeUnchanged = true; }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
