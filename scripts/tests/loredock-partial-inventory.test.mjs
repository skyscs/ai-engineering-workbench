import assert from 'node:assert/strict';
import { test } from 'node:test';
import { controls, inputFor, references, catalogRoots } from '../loredock-partial-inventory/inputs.mjs';
import { requireParsedTerminal } from '../loredock-partial-inventory/observe.mjs';

function inventory(control) {
  return { buildId: 'ordinary-build', status: control.status, published: true, currentParser: true, staleIndex: false,
    candidates: control.codeFiles, examined: control.codeFiles, counts: { parsed: control.codeFiles },
    gaps: control.gap ? 1 : 0, filesWithGaps: control.gap ? 1 : 0 };
}

test('ordinary partial variants add exactly one unrelated file and preserve all eight required originals', () => {
  const baseline = inputFor('completed');
  for (const id of ['constant', 'dynamic-request']) {
    const value = inputFor(id), before = Object.entries(baseline.corpus).flatMap(([source, files]) => Object.keys(files).map(file => source + '/' + file));
    const after = Object.entries(value.corpus).flatMap(([source, files]) => Object.keys(files).map(file => source + '/' + file));
    assert.equal(after.filter(file => !before.includes(file)).length, 1);
    for (const [source, files] of Object.entries(baseline.corpus)) for (const [file, text] of Object.entries(files)) assert.equal(value.corpus[source][file], text);
    assert.equal(value.expected.requiredOriginals.length, 8);
    for (const reference of Object.values(references)) assert(value.corpus[reference.source][reference.path].includes(reference.quote));
  }
  assert.deepEqual(inputFor('no-analysis').corpus, baseline.corpus);
  assert.equal(inputFor('no-analysis').expected.setup, 'catalog-only');
  assert.equal(catalogRoots.length, 5); assert.equal(new Set(catalogRoots).size, 5);
  assert.throws(() => inputFor('kiln'));
});

test('terminal parsed partial coverage remains partial and grants no native usefulness or qualification', () => {
  for (const control of controls.slice(0, 3)) {
    const value = inventory(control), before = structuredClone(value);
    const observation = requireParsedTerminal(value, 'ordinary-build', control);
    assert.deepEqual(value, before); assert.equal(observation.coverage, control.status);
    assert.equal(observation.processing, 'terminal-all-parsed'); assert.equal(observation.qualification, false);
    assert.equal(observation.nativeUsefulness, 'not-established-by-inventory-status');
  }
});

test('running, incompatible, stale, mixed or unfinished file states cannot enter the terminal diagnostic', () => {
  const control = controls[1];
  for (const mutate of [value => { value.status = 'running'; }, value => { value.status = 'paused'; },
    value => { value.published = false; }, value => { value.currentParser = false; }, value => { value.staleIndex = true; },
    value => { value.buildId = 'different-build'; }, value => { value.examined--; },
    value => { value.counts = { parsed: 5, unattempted: 1 }; }, value => { value.counts.failed = 1; },
    value => { value.gaps = 0; }, value => { value.filesWithGaps = 2; }]) {
    const value = inventory(control); mutate(value);
    assert.throws(() => requireParsedTerminal(value, 'ordinary-build', control));
  }
});
