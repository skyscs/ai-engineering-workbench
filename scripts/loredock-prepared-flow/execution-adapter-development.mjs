// Ordinary adapter controls only: fixed successful-reference and failed-fresh-setup cases.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { save, normalized, materialize } from './io.mjs';
import { inputFor as ordinaryInput } from './matrix-development-inputs.mjs';
import { matrixCases } from './matrix-cases.mjs';
import { matrixCatalogRoots, matrixWorkingRows } from './matrix-layout.mjs';
import { resourceCaseOrder } from './coordinator.mjs';
import { oracleCase } from './oracle-case.mjs';
import { ordinaryCorpus, ordinaryCases, ordinaryReferences, ordinaryNote } from './ordinary-oracles.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
const references = {
  vue: { source: 'a-permit-ui', path: 'ui/AAApply.vue', quote: 'const apply = () => requestPermit(props.tenant, props.permit);' },
  request: { source: 'a-permit-ui', path: 'ui/request.ts', quote: 'fetch("/permits/grants"' },
  write: { source: 'c-permit-store', path: 'PermitWriter.java', quote: 'collection.replaceOne(selector, event, true);' },
};
const expected = { ...ordinaryInput('representative').expected, requiredOriginals: Object.keys(references) };
const oracles = Array.from({ length: 10 }, (_, i) => ({ ...expected, id: 'P' + String(i + 1).padStart(2, '0') + '-adapter',
  variant: 'representative', question: ordinaryInput('representative').question,
  ...(i === 6 ? { setup: 'catalog-only', prepared: 'unavailable-omission-required' } : {}) }));
const catalogRoots = matrixCatalogRoots(oracles.map(row => row.id)), workingRows = matrixWorkingRows(oracles.map(row => row.id));
function input(partial) {
  const value = ordinaryInput('representative'); value.expected = expected;
  if (partial) {
    value.corpus['a-permit-ui']['padding/constant.ts'] = 'export const adapterPadding = 1;\n';
    value.expectedFiles++; value.expectedCodeFiles++;
  }
  return value;
}
await mkdir(output);
const report = { family: 'ordinary-execution-adapter-01', errors: [], cases: [], modelCalls: 0,
  reservedFamilyReads: 0, resourceQualification: false, fullMatrix: false };
try {
  await save(path.join(output, 'plan.json'), { family: report.family, groups: [
    { name: 'positive', files: 12, caseIndexes: [0, 2, 14] }, { name: 'partial', files: 13, caseIndexes: [0, 3, 5, 13] }],
    references, expected, oracles, noteCase: ordinaryCases[8], repeatPolicy: 'One fixed execution of each declared control; no retries.' });
  for (const [name, partial, indexes] of [['positive', false, [0, 2, 14]], ['partial', true, [0, 3, 5, 13]]]) {
    const ownerOutput = path.join(output, name), matrix = path.join(ownerOutput, 'run/matrix'); await mkdir(matrix, { recursive: true });
    const cases = matrixCases({ ownerOutput, catalogRoots, workingRows, inputFor: () => input(partial),
      oracleInputFor: () => input(partial).corpus, oracles, references, engineerNote: ordinaryNote,
      sourceName: 'z-independent-notes', noteTarget: null });
    for (const index of indexes) {
      const directory = path.join(matrix, resourceCaseOrder[index]); await mkdir(directory);
      const result = await cases[index].run({ directory });
      report.cases.push({ group: name, id: cases[index].id, result });
      assert.equal(result.safeToContinue, true, 'Unknown adapter/control failure stops the remaining controls.');
      assert.notEqual(result.status, 'passed', 'Ordinary failed/incomplete coverage must not become qualification.');
    }
  }
  const directory = path.join(output, 'note'); await mkdir(directory);
  const corpus = ordinaryCorpus(), sources = await materialize(path.join(directory, 'sources'), corpus);
  await save(path.join(directory, 'sources.json'), sources);
  report.note = await oracleCase({ directory: path.join(directory, 'case'), corpus, sources, expected: ordinaryCases[8],
    references: ordinaryReferences, engineerNote: ordinaryNote,
    noteTarget: { kind: 'http-target', from: { source: 'a-permit-ui', path: 'ui/request.ts' },
      to: { source: 'b-permit-api', path: 'routes.json' }, requiredOriginals: ['request', 'header'] } });
  assert.deepEqual(report.note.errors, []); assert.deepEqual(report.note.assessmentErrors, []); assert.equal(report.note.preparations, 1);
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally { await save(path.join(output, 'result.json'), report); }
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ group: row.group, id: row.id, ...row.result.details,
  status: row.result.status, safeToContinue: row.result.safeToContinue })), notePassed: report.note?.passed,
  modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false }, null, 2));
