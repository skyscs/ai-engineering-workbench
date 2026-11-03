import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { configuration as base, oracle as positive } from './streaming-qualification-config.js';
import { corpusFactory as supported } from './memory-runner-config.js';

// Independent development cases, never qualification inputs or production adapter changes.
export function corpusFactory(unsupported = false) {
  const corpus = supported();
  if (unsupported) corpus['c-locker-store']!['LockerWriter.java'] = corpus['c-locker-store']!['LockerWriter.java']!
    .replace('void onMessage(', 'void onReserved(');
  return corpus;
}
export async function configuration(caseId: number) {
  assert.ok(caseId === 0 || caseId === 1);
  const config = await base(0), corpus = corpusFactory(caseId === 1);
  const size = { ...config.size, bytes: Object.values(corpus).flatMap(files => Object.values(files))
    .reduce((sum, text) => sum + Buffer.byteLength(text), 0) };
  const requiredNodes = positive.requiredNodes.filter(row => row[0] !== 'c-locker-store');
  const oracle = caseId === 0 ? positive : { ...positive, terminalKind: 'event-publish', defaultOriginals: 7,
    expectDelivery: false, requiredOmission: 'unresolved-consumer-method', requiredNodes, selectedRequiredNodes: requiredNodes };
  return { ...config, size, oracle, corpusFactory: () => corpus,
    expectedCorpusHash: createHash('sha256').update(JSON.stringify(corpus)).digest('hex') };
}
