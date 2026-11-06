import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyFacts, type CodeFacts } from '../src/code-facts.js';
import { OwnedFileParser } from '../src/file-parser.js';
import { factRanges } from '../src/code-analysis-facts.js';
import { decodeParserReply, encodeParserFrame, encodeParserReply, fileParserDigest, fileParserLimits, fileParserProtocol,
  FileParserError, packParserFacts, unpackParserFacts, validateParserFacts } from '../src/file-parser-protocol.js';
// @ts-expect-error Immutable fixture loading is shared with emitted JavaScript tests.
import { retainedTransportCases } from './fixtures/parser-transport-reference/read.mjs';

const binding = { version: fileParserProtocol, generation: 'a'.repeat(36), identity: 'b'.repeat(64) } as const;
const reply = (facts: CodeFacts) => ({ ...binding, type: 'facts' as const, id: 1, digest: fileParserDigest('control.ts', ''), facts });
const code = (expected: string) => (error: unknown) => error instanceof FileParserError && error.code === expected;

test('string factoring preserves exact order, Unicode, optional fields and prototype-sensitive dictionary keys', () => {
  const content = '// 🚢 café\nfunction demo() {}';
  const facts: CodeFacts = { gaps: ['escaped\u0000text', '\ud800', 'repeat', 'repeat'],
    records: JSON.parse('{"__proto__":"safe","constructor":"safe","0":"zero","toString":"text"}') as Record<string, string>,
    calls: [], operations: [], symbols: [{ end: content.length, start: 0, key: 'demo:0', name: 'demo',
      qualifiedName: 'Example.demo', role: 'java-method', exported: true, className: 'Example', parameterTypes: ['String', 'String'] }] };
  validateParserFacts(facts, content);
  const packed = packParserFacts(facts), actual = unpackParserFacts(packed);
  assert.equal(JSON.stringify(actual), JSON.stringify(facts)); validateParserFacts(actual, content);
  assert.equal(Object.getPrototypeOf(actual.records), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(actual.records, '__proto__')?.value, 'safe');
  assert.equal(Object.getOwnPropertyDescriptor(Object.prototype, 'safe'), undefined);
  assert.equal(new Set(packed.strings).size, packed.strings.length);
  assert.equal(packed.strings.filter(value => value === 'repeat').length, 1);
  const absent = emptyFacts();
  assert.equal(JSON.stringify(unpackParserFacts(packParserFacts(absent))), JSON.stringify(absent));
});

test('incremental compact accounting and the complete envelope enforce the exact unchanged byte bound', () => {
  const facts = (text: string) => ({ ...emptyFacts(), records: { blob: text } });
  const innerBase = Buffer.byteLength(JSON.stringify(packParserFacts(facts('x'))));
  const text = 'x'.repeat(fileParserLimits.responseBytes - innerBase + 1);
  assert.equal(Buffer.byteLength(JSON.stringify(packParserFacts(facts(text)))), fileParserLimits.responseBytes);
  assert.throws(() => packParserFacts(facts(text + 'x')), code('PARSER_FRAME_LIMIT'));
  assert.throws(() => encodeParserReply(reply(facts(text))), code('PARSER_FRAME_LIMIT'));
  const outerBase = encodeParserReply(reply(facts('x'))).byteLength;
  const framed = facts('x'.repeat(fileParserLimits.responseBytes - outerBase + 1));
  const frame = encodeParserReply(reply(framed)); assert.equal(frame.byteLength, fileParserLimits.responseBytes);
  const restored = decodeParserReply(frame); assert.equal(restored.type, 'facts');
  if (restored.type === 'facts') assert.equal(JSON.stringify(restored.facts), JSON.stringify(framed));
});

test('malformed string tables, references, tags, nesting and unsupported scalar values fail closed', () => {
  const invalid: unknown[] = [
    { strings: [], value: [1], extra: true }, { strings: ['a', 'a'], value: [0, 0] },
    { strings: ['unused'], value: [1] }, { strings: ['a', 'b'], value: [1, [1, true], [0, false]] },
    { strings: ['a'], value: [0, -1] }, { strings: ['a'], value: [0, '0'] },
    { strings: [], value: [0, 0] }, { strings: ['a'], value: [0, 0, 0] },
    { strings: [], value: [3] }, { strings: ['a'], value: [1, [0, true], [0, false]] },
    { strings: ['a'], value: [1, [0]] }, { strings: [], value: null },
    { strings: [], value: 1.5 }, { strings: [false], value: [0, 0] },
    { strings: ['x'.repeat(fileParserLimits.responseBytes + 1)], value: [0, 0] },
  ];
  let nested: unknown = true; for (let depth = 0; depth < 10; depth++) nested = [2, nested];
  invalid.push({ strings: [], value: nested });
  for (const value of invalid) assert.throws(() => unpackParserFacts(value), code('PARSER_PROTOCOL'));
  for (const value of [null, undefined, NaN, Infinity, 1.5]) {
    assert.throws(() => packParserFacts({ ...emptyFacts(), records: { invalid: value } } as unknown as CodeFacts), code('PARSER_PROTOCOL'));
  }
});

test('protocol v1 and direct fact payloads cannot masquerade as compact v2 replies', () => {
  for (const value of [{ ...binding, type: 'ready', version: 'loredock-file-parser/1' },
    reply(emptyFacts()), { ...reply(emptyFacts()), facts: { ...packParserFacts(emptyFacts()), hidden: true } }]) {
    assert.throws(() => decodeParserReply(encodeParserFrame(value, fileParserLimits.responseBytes)), code('PARSER_PROTOCOL'));
  }
});

test('decoding cooperates with the caller deadline before returning reconstructed facts', () => {
  const facts = { ...emptyFacts(), gaps: Array.from({ length: 1200 }, () => 'repeat') };
  const frame = encodeParserReply(reply(facts)); let checks = 0;
  assert.throws(() => decodeParserReply(frame, () => { if (++checks === 4) throw new FileParserError('PARSER_DEADLINE'); }), code('PARSER_DEADLINE'));
  assert.equal(checks, 4);
});

test('a real source worker preserves the original facts that exceeded the old response bound', async t => {
  const parser = new OwnedFileParser(); t.after(() => parser.stop());
  await parser.start({ deadline: performance.now() + 15000 });
  const cases = await retainedTransportCases() as { id: string; path: string; content: string; serialized: string }[];
  for (const input of cases) await t.test(input.id, async () => {
    const expected = JSON.parse(input.serialized) as CodeFacts;
    const actual = await parser.parse(input.path, input.content, { deadline: performance.now() + 15000 });
    assert.equal(JSON.stringify(actual), input.serialized); validateParserFacts(actual, input.content);
    assert.deepEqual(factRanges(input.content, actual), factRanges(input.content, expected));
    assert(encodeParserReply(reply(actual)).byteLength <= fileParserLimits.responseBytes);
  });
  await parser.stop(); assert.equal(parser.snapshot().state, 'closed'); assert.equal(parser.snapshot().owned, false);
});
