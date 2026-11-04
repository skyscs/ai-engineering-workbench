import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Offline contract values, deliberately independent of application constants/codecs.
export const limits = Object.freeze({ projectionBytes: 524288, receiptBytes: 655360, textBytes: 65536, spans: 30, sources: 20, depth: 40 });
export const analysisLimits = Object.freeze({ documents: 10000, fileBytes: 32768, fileSpans: 8, textBytes: 52428800,
  filePayloadBytes: 131072, payloadBytes: 16777216, wallMs: 300000 });
export const pathLimits = Object.freeze({ files: 10000, facts: 10000, wallMs: 5000, work: 1000000,
  metadataEntries: 10000, metadataBytes: 8388608, resolutionNodes: 12000, resolutionEdges: 12000,
  bindingRecords: 12000, alternativeReferences: 12000, nodes: 160, edges: 240, flows: 2, steps: 20,
  traversals: 1000, pendingPaths: 1000, comparisons: 2000, outputBytes: 524288 });
export const hash = value => createHash('sha256').update(value).digest('hex');
export const bytes = value => Buffer.byteLength(value, 'utf8');
export const eq = (actual, expected) => assert.deepEqual(actual, expected);
export const number = (max = Number.MAX_SAFE_INTEGER, min = 0) => value => assert.ok(Number.isSafeInteger(value) && value >= min && value <= max);
export const text = (max = limits.receiptBytes, min = 0) => value => assert.ok(typeof value === 'string' && value.isWellFormed() && bytes(value) >= min && bytes(value) <= max);
export const choice = (...values) => value => assert.ok(values.includes(value));
export const optionalNull = check => value => { if (value !== null) check(value); };
export const list = (check, max, min = 0) => value => { assert.ok(Array.isArray(value) && value.length >= min && value.length <= max); value.forEach(check); };
export const object = value => assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
export function fields(value, required, optional = {}) {
  object(value); eq(Object.keys(value).filter(key => !Object.hasOwn(optional, key)).sort(), Object.keys(required).sort());
  for (const [key, check] of Object.entries(required)) check(value[key]);
  for (const key of Object.keys(optional)) if (Object.hasOwn(value, key)) optional[key](value[key]);
}
export const dict = (check, max = 20000) => value => { object(value); assert.ok(Object.keys(value).length <= max); Object.values(value).forEach(check); };
export const hex = value => { text(64, 64)(value); assert.match(value, /^[a-f0-9]{64}$/); };
export const uuid = value => { text(36, 36)(value); assert.match(value, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); };
export const gitId = value => { text(64, 40)(value); assert.match(value, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/); };
export const unique = values => eq(new Set(values).size, values.length);
export const sorted = values => { unique(values); eq(values, [...values].sort()); };
export const counts = value => dict(number())(value);
export const bounds = ceilings => value => fields(value, Object.fromEntries(Object.entries(ceilings).map(([key, max]) => [key, number(max)])));
export const locator = { sourceName: text(512, 1), path: value => { text(4096, 1)(value); assert.ok(!/[\\\0]/.test(value)
  && !/^[A-Za-z]:/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..')); }, revision: gitId, startLine: number(undefined, 1), endLine: number(undefined, 1) };
export const evidence = value => fields(value, { id: uuid, ...locator });
export const ids = list(uuid, 30, 1);
export const strings = list(text(), 20000);
export const versions = { buildId: uuid, policyVersion: number(), sourceSetVersion: number(), registryVersion: number() };
export const resolution = Object.fromEntries(['candidateDocuments', 'examinedDocuments', 'parsedBytes', 'comparisons', 'alternativeReferences'].map(key => [key, number()]));
export function canonical(value, depth = 0) {
  assert.ok(depth <= limits.depth, 'JSON depth exceeds the offline bound.');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') { text(limits.receiptBytes * 2)(value); return JSON.stringify(value); }
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  object(value); return '{' + Object.keys(value).sort().map(key => { text()(key); return JSON.stringify(key) + ':' + canonical(value[key], depth + 1); }).join(',') + '}';
}
export function parse(input, maximum, ordered = false) {
  assert.ok(Buffer.isBuffer(input) && input.length <= maximum, 'Offline JSON byte bound exceeded.');
  const serialized = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input), value = JSON.parse(serialized);
  const normalized = canonical(value); eq(serialized, ordered ? JSON.stringify(value) : normalized);
  return value;
}
