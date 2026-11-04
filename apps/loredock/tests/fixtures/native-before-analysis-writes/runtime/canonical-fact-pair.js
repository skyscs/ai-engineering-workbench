export const canonicalFactPairLimit = 4 * 1024;
const keys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === expected;
const empty = (value) => Array.isArray(value) && value.length === 0;
/** Call only after full payload validation. One request owns one exact immutable shape. */
export function createCanonicalFactPair() {
    let signature, canonical;
    return (facts, ranges) => {
        const original = { facts, ranges };
        if (!keys(facts, 'calls,gaps,operations,records,symbols') || !keys(ranges, 'offsetEncoding,operations,symbols')
            || !empty(facts.symbols) || !empty(facts.operations) || !empty(facts.calls) || !keys(facts.records, '')
            || !Array.isArray(facts.gaps) || !facts.gaps.every(gap => typeof gap === 'string')
            || ranges.offsetEncoding !== 'UTF-16 code units' || !empty(ranges.symbols) || !empty(ranges.operations))
            return original;
        const serialized = JSON.stringify(original);
        if (Buffer.byteLength(serialized) > canonicalFactPairLimit)
            return original;
        if (canonical === undefined) {
            signature = serialized;
            const copy = JSON.parse(serialized);
            for (const value of [copy.facts.symbols, copy.facts.operations, copy.facts.calls, copy.facts.records,
                copy.facts.gaps, copy.ranges.symbols, copy.ranges.operations, copy.facts, copy.ranges, copy])
                Object.freeze(value);
            canonical = copy;
        }
        return serialized === signature ? canonical : original;
    };
}
