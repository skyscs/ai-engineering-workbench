import type { CodeFacts } from './code-facts.js';
import type { FactRanges } from './code-analysis-types.js';

export const canonicalFactPairLimit = 4 * 1024;
type ReadonlyValue<T> = T extends readonly unknown[] ? ReadonlyArray<ReadonlyValue<T[number]>>
  : T extends object ? { readonly [K in keyof T]: ReadonlyValue<T[K]> } : T;
export type CanonicalFactPair = ReadonlyValue<{ facts: CodeFacts; ranges: FactRanges }>;
const keys = (value: unknown, expected: string) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === expected;
const empty = (value: unknown) => Array.isArray(value) && value.length === 0;

/** Call only after full payload validation. One request owns one exact immutable shape. */
export function createCanonicalFactPair(): (facts: CodeFacts, ranges: FactRanges) => CanonicalFactPair {
  let signature: string | undefined, canonical: CanonicalFactPair | undefined;
  return (facts, ranges) => {
    const original = { facts, ranges };
    if (!keys(facts, 'calls,gaps,operations,records,symbols') || !keys(ranges, 'offsetEncoding,operations,symbols')
      || !empty(facts.symbols) || !empty(facts.operations) || !empty(facts.calls) || !keys(facts.records, '')
      || !Array.isArray(facts.gaps) || !facts.gaps.every(gap => typeof gap === 'string')
      || ranges.offsetEncoding !== 'UTF-16 code units' || !empty(ranges.symbols) || !empty(ranges.operations)) return original;
    const serialized = JSON.stringify(original);
    if (Buffer.byteLength(serialized) > canonicalFactPairLimit) return original;
    if (canonical === undefined) {
      signature = serialized;
      const copy = JSON.parse(serialized) as { facts: CodeFacts; ranges: FactRanges };
      for (const value of [copy.facts.symbols, copy.facts.operations, copy.facts.calls, copy.facts.records,
        copy.facts.gaps, copy.ranges.symbols, copy.ranges.operations, copy.facts, copy.ranges, copy]) Object.freeze(value);
      canonical = copy;
    }
    return serialized === signature ? canonical : original;
  };
}
