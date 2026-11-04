import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Offline representation helper; no frozen corpus or probe.
import { createCanonicalPair, canonicalPairLimit } from '../../../scripts/loredock-canonical-facts/pair.mjs';

const input = (gaps: string[] = ['no-supported-code']) => ({
  facts: { symbols: [], operations: [], calls: [], records: {}, gaps },
  ranges: { offsetEncoding: 'UTF-16 code units', symbols: [], operations: [] },
});

test('canonical fact pairs share immutable equal values without freezing or mutating inputs', () => {
  const pair = createCanonicalPair(), original = input(), copy = structuredClone(original);
  const first = pair(original.facts, original.ranges), second = pair(copy.facts, copy.ranges);
  assert.equal(first, second); assert.deepEqual(first, original); assert.notEqual(first.facts, original.facts);
  for (const value of [first, first.facts, first.ranges, first.facts.gaps, first.facts.records,
    first.facts.symbols, first.facts.operations, first.facts.calls, first.ranges.symbols, first.ranges.operations]) assert.ok(Object.isFrozen(value));
  assert.throws(() => first.facts.gaps.push('changed'), TypeError);
  original.facts.gaps.push('changed'); assert.deepEqual(first.facts.gaps, ['no-supported-code']);
  const changed = pair(original.facts, original.ranges); assert.equal(changed.facts, original.facts);
  assert.equal(pair(copy.facts, copy.ranges), first);
});

test('one canonical slot preserves different and ordered gaps and never crosses requests', () => {
  const pair = createCanonicalPair(), first = input(['a', 'b']), other = input(['b', 'a']), blank = input([]);
  const canonical = pair(first.facts, first.ranges);
  for (const value of [other, blank, input(['a', 'a', 'b'])]) {
    const result = pair(value.facts, value.ranges); assert.equal(result.facts, value.facts); assert.equal(result.ranges, value.ranges);
  }
  assert.equal(pair(first.facts, first.ranges), canonical);
  const fresh = createCanonicalPair()(first.facts, first.ranges); assert.notEqual(fresh, canonical); assert.deepEqual(fresh, canonical);
  const empty = createCanonicalPair()(blank.facts, blank.ranges); assert.deepEqual(empty, blank); assert.notEqual(empty.facts, blank.facts);
});

test('canonical bounds use UTF-8 bytes and oversized inputs do not occupy the slot', () => {
  const pair = createCanonicalPair(), blank = input(['']), overhead = Buffer.byteLength(JSON.stringify(blank));
  const boundary = input(['x'.repeat(canonicalPairLimit - overhead)]), oversized = input(['x'.repeat(canonicalPairLimit - overhead + 1)]);
  assert.equal(Buffer.byteLength(JSON.stringify(boundary)), canonicalPairLimit);
  assert.equal(pair(oversized.facts, oversized.ranges).facts, oversized.facts);
  const unicode = input(['😀'.repeat(1100)]); assert.ok(Buffer.byteLength(JSON.stringify(unicode)) > canonicalPairLimit);
  assert.equal(pair(unicode.facts, unicode.ranges).facts, unicode.facts);
  const shared = pair(boundary.facts, boundary.ranges); assert.notEqual(shared.facts, boundary.facts);
  assert.equal(pair(boundary.facts, boundary.ranges), shared);
});

test('supported or unknown shapes fall back without changing the first eligible pair', () => {
  const pair = createCanonicalPair(), base = input();
  const variants = [
    { ...base, facts: { ...base.facts, symbols: [{ key: 'real-symbol' }] } },
    { ...base, facts: { ...base.facts, records: { Named: 'String key' } } },
    { ...base, facts: { ...base.facts, extension: [] } },
    { ...base, ranges: { ...base.ranges, extension: 1 } },
    { ...base, ranges: { ...base.ranges, symbols: [{ key: 'range' }] } },
    { ...base, ranges: { ...base.ranges, offsetEncoding: 'other' } },
  ];
  for (const value of variants) { const result = pair(value.facts, value.ranges); assert.equal(result.facts, value.facts); assert.equal(result.ranges, value.ranges); }
  assert.notEqual(pair(base.facts, base.ranges).facts, base.facts);
});

test('canonical path fork differs only at the declared retention seam and dependencies stay pinned', async () => {
  const root = new URL('../../../', import.meta.url);
  const baseline = await readFile(new URL('scripts/loredock-compact-payloads/paths.mjs', root), 'utf8');
  const candidate = await readFile(new URL('scripts/loredock-canonical-facts/paths.mjs', root), 'utf8');
  assert.equal(candidate, "import { createCanonicalPair } from './pair.mjs';\n" + baseline
    .replace('export function createCompactPaths(', 'export function createCanonicalPaths(')
    .replace('const entries = [], consumed = [];', 'const entries = [], consumed = [], canonicalPair = createCanonicalPair();')
    .replace('entries.push({ file, payload: { facts: payload.facts, ranges: payload.ranges, evidence: payload.evidence } });',
      'entries.push({ file, payload: { ...canonicalPair(payload.facts, payload.ranges), evidence: payload.evidence } });'));
  const manifest = JSON.parse(await readFile(new URL('scripts/loredock-canonical-facts/baseline.json', root), 'utf8')) as { files: Record<string, string> };
  for (const [file, expected] of Object.entries(manifest.files)) assert.equal(sha256(await readFile(new URL(file, root))), expected, file);
});
