export const canonicalPairLimit = 4 * 1024;
const keys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === expected;
const empty = value => Array.isArray(value) && value.length === 0;

// One request owns one exact shape. Inputs have already passed full file validation.
export function createCanonicalPair() {
  let signature, canonical;
  return (facts, ranges) => {
    const original = { facts, ranges };
    if (!keys(facts, 'calls,gaps,operations,records,symbols') || !keys(ranges, 'offsetEncoding,operations,symbols')
      || !empty(facts.symbols) || !empty(facts.operations) || !empty(facts.calls) || !keys(facts.records, '')
      || !Array.isArray(facts.gaps) || !facts.gaps.every(gap => typeof gap === 'string')
      || ranges.offsetEncoding !== 'UTF-16 code units' || !empty(ranges.symbols) || !empty(ranges.operations)) return original;
    const serialized = JSON.stringify(original);
    if (Buffer.byteLength(serialized) > canonicalPairLimit) return original;
    if (signature === undefined) {
      signature = serialized; canonical = JSON.parse(serialized);
      for (const value of [canonical.facts.symbols, canonical.facts.operations, canonical.facts.calls, canonical.facts.records,
        canonical.facts.gaps, canonical.ranges.symbols, canonical.ranges.operations, canonical.facts, canonical.ranges, canonical]) Object.freeze(value);
    }
    return serialized === signature ? canonical : original;
  };
}
