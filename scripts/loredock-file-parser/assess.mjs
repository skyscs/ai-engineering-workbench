import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { typescriptFacts } from '../../apps/loredock/dist/code-typescript.js';
import { javaFacts } from '../../apps/loredock/dist/code-java.js';
import { factRanges } from '../../apps/loredock/dist/code-analysis-facts.js';

const [directory, destination, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0); assert(path.isAbsolute(directory) && path.isAbsolute(destination));
const json = name => JSON.parse(readFileSync(path.join(directory, name + '.json'), 'utf8'));
const lines = name => readFileSync(path.join(directory, name + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const result = json('result'), inputs = json('inputs'), samples = lines('samples'), worker = lines('worker-samples'), events = lines('events');
assert.equal(result.failure, null); assert.deepEqual(result.survivors, []); assert.equal(result.owner.owned, false);
assert.equal(result.owner.state, 'closed'); assert.equal(result.threads.length, 1); assert.equal(inputs.length, 8);
const facts = inputs.map(([file, content], index) => {
  const actual = json('facts-' + index), expected = file.endsWith('.java') ? javaFacts(content) : typescriptFacts(content, file);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected)); assert.deepEqual(factRanges(content, actual), factRanges(content, expected));
  return { path: file, symbols: actual.symbols.length, operations: actual.operations.length, gaps: actual.gaps.length };
});
const heap = worker.filter(row => row.heap.status === 'fulfilled'); assert(heap.length && samples.length);
const maximum = values => Math.max(...values);
const parentHeap = maximum(samples.map(row => row.memory.heapUsed)), workerHeap = maximum(heap.map(row => row.heap.value.used_heap_size));
const first = events.find(row => row.type === 'worker-created'), last = events.find(row => row.type === 'worker-exit');
const createdToFirstCompletionMs = heap[0].completed - first.created;
const observation = { resourceQualification: false, facts, sourceParity: true, rangesParity: true,
  elapsedMs: result.ended - result.began, processCpu: result.processCpu, samples: samples.length, workerSamples: worker.length,
  rejectedHeapSamples: worker.filter(row => row.heap.status === 'rejected').length,
  pendingSampleTicks: result.threads[0].skipped, parentHeapMaximum: parentHeap, workerHeapMaximum: workerHeap,
  observedHeapMaximaSum: parentHeap + workerHeap, processRssMaximum: maximum(samples.map(row => row.memory.rss)),
  processHighWaterRssMaximum: maximum(samples.map(row => row.processHighWaterRssBytes)),
  mainIntervalMaximumMs: maximum(samples.map(row => row.gapMs)), createdToFirstCompletionMs,
  workerLastCompletionToExitMs: last.now - heap.at(-1).completed,
  workerRequestCompletionMaximumMs: maximum(worker.map(row => row.completed - row.requested)),
  limitation: 'External statistics complete asynchronously. Sampled maxima are not simultaneous or continuous peaks. Startup coverage is incomplete; no heap or production-startup qualification.',
};
writeFileSync(destination, JSON.stringify(observation, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(observation, null, 2));
