import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { graphSemantics } from './loredock-durable-flows.mjs';
import { isDeepStrictEqual } from 'node:util';

// Review serialized observations only. No catalog, Git, parser, model or measurement rerun.
const input = process.argv[2];
assert.ok(input, 'Pass a retained result JSON or JSON.gz file.');
const bytes = await readFile(input), raw = input.endsWith('.gz') ? gunzipSync(bytes) : bytes, receipt = JSON.parse(raw);
assert.equal(receipt.schemaVersion, 'loredock-durable-flow-comparison/1');
assert.equal(receipt.cases.length, 21);
const cases = receipt.cases.filter(item => item.support);
const parity = cases.map(item => {
  const control = item.observations.find(value => value.mode === 'control'), saved = item.observations.find(value => value.mode === 'parity');
  const fields = value => value.payloads.map(({ fileId, path, sourceId, facts, ranges, evidence }) => ({ fileId, path, sourceId, facts, ranges, evidence }));
  return { case: item.id, orderedGraph: isDeepStrictEqual(graphSemantics(control.graph), graphSemantics(saved.graph)),
    serializedFactsRangesOriginals: isDeepStrictEqual(fields(control), fields(saved)),
    exactSelection: isDeepStrictEqual(control.selection, saved.selection) };
});
const observations = receipt.cases.flatMap(item => item.observations);
const dense = receipt.cases.find(item => item.id === 'F03').observations.find(value => value.mode === 'wide').payloads.find(file => file.path === 'a.ts');
const report = { schemaVersion: 'loredock-durable-flow-review/1', measuredReceiptSha256: createHash('sha256').update(raw).digest('hex'),
  measurementImplementation: receipt.implementationCommit, measurementsRepeated: false,
  originalSummary: receipt.summary, serializedParity: parity,
  interpretation: "Six live-object comparisons distinguished the parser record dictionary's null prototype from the plain object prototype restored by JSON. Serialized semantic vectors are equal. The raw failed checks remain unchanged.",
  denseOracle: { expectedSymbols: 200, retainedSymbols: dense.facts.symbols.length, gaps: dense.facts.gaps, satisfied: false,
    interpretation: 'The frozen assumption missed the existing 100-symbol TypeScript parser cap. This case does not saturate the 160-node graph and cannot qualify dense-file admission.' },
  projectionObservations: observations.length,
  allProjectionReadsUnchanged: observations.every(item => Object.values(item.measurement.projectionWork).every(value => value === 0)),
  originalSpansReopenedIncludingRepeats: observations.reduce((sum, item) => sum + item.reopened.length, 0),
  allHarnessReadsCompleted: observations.every(item => item.status !== 'harness-failed'),
  decision: 'Reject naive wider-input production promotion: F02 retains seven critical facts but admits only three required nodes, with 211 node-limit omissions. Keep production unchanged; scope support-aware selection separately.' };
assert.ok(report.serializedParity.every(item => item.orderedGraph && item.serializedFactsRangesOriginals && item.exactSelection));
assert.ok(report.allProjectionReadsUnchanged && report.allHarnessReadsCompleted);
assert.equal(report.denseOracle.retainedSymbols, 100); assert.ok(report.denseOracle.gaps.includes('typescript-symbol-limit'));
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv[3]) await writeFile(process.argv[3], output); else console.log(output);
