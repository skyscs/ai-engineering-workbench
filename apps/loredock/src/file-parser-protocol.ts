import { createHash } from 'node:crypto';
import type { CodeFacts, SymbolFact } from './code-facts.js';

export const fileParserProtocol = 'loredock-file-parser/2';
export const fileParserLimits = Object.freeze({ contentBytes: 32768, requestBytes: 256 * 1024,
  responseBytes: 512 * 1024, wallMs: 300000, cleanupMs: 2000 });
export class FileParserError extends Error {
  constructor(readonly code: string) { super(`File parser operation failed: ${code}.`); }
}
export function requireParser(value: unknown, code = 'PARSER_PROTOCOL'): asserts value {
  if (!value) throw new FileParserError(code);
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
function keys(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  requireParser(object(value) && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key)));
}
const hex = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const generation = (value: unknown) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const dictionary = (value: unknown) => object(value) && Object.values(value).every(item => typeof item === 'string');
export const fileParserDigest = (path: string, content: string) => createHash('sha256').update(JSON.stringify([path, content])).digest('hex');
interface Binding { version: typeof fileParserProtocol; generation: string; identity: string }
export interface ParseRequest extends Binding { type: 'parse'; id: number; path: string; content: string; digest: string }
export type ParserReply = (Binding & { type: 'ready' }) | (Binding & { type: 'facts'; id: number; digest: string; facts: CodeFacts })
  | (Binding & { type: 'error'; id: number; digest: string; code: 'PARSER_EXTRACTION_FAILED' | 'PARSER_RESULT_LIMIT' });

type PackedValue = number | boolean | [0, number] | PackedObject | PackedArray;
interface PackedObject extends Array<1 | [number, PackedValue]> { 0: 1 }
interface PackedArray extends Array<PackedValue> { 0: 2 }
export interface PackedParserFacts { strings: string[]; value: PackedValue }
const nestingLimit = 8;

/** Lossless ordered JSON structure with shared strings; count compact bytes before retaining them. */
export function packParserFacts(facts: CodeFacts): PackedParserFacts {
  const strings: string[] = [], indices = new Map<string, number>();
  let bytes = Buffer.byteLength('{"strings":[],"value":}');
  const charge = (size: number) => { bytes += size; requireParser(bytes <= fileParserLimits.responseBytes, 'PARSER_FRAME_LIMIT'); };
  const intern = (value: string) => {
    const known = indices.get(value); if (known !== undefined) return known;
    charge(Buffer.byteLength(JSON.stringify(value)) + (strings.length ? 1 : 0));
    const index = strings.length; strings.push(value); indices.set(value, index); return index;
  };
  const pack = (value: unknown, depth: number): PackedValue => {
    requireParser(depth <= nestingLimit);
    if (typeof value === 'string') { const index = intern(value); charge(4 + String(index).length); return [0, index]; }
    if (typeof value === 'boolean') { charge(value ? 4 : 5); return value; }
    if (typeof value === 'number') { requireParser(Number.isSafeInteger(value)); charge(String(value).length); return value; }
    charge(3);
    if (Array.isArray(value)) {
      const output: PackedArray = [2];
      for (const child of value) { charge(1); output.push(pack(child, depth + 1)); }
      return output;
    }
    requireParser(object(value)); const output: PackedObject = [1];
    for (const [key, child] of Object.entries(value)) {
      const index = intern(key); charge(4 + String(index).length); output.push([index, pack(child, depth + 1)]);
    }
    return output;
  };
  return { strings, value: pack(facts, 0) };
}

/** Decode bounded references directly; never allocate an expanded JSON string. */
export function unpackParserFacts(value: unknown, check?: () => void): CodeFacts {
  keys(value, ['strings', 'value']);
  requireParser(Array.isArray(value.strings) && value.strings.every(item => typeof item === 'string'));
  const strings = value.strings as string[];
  let stringBytes = 0;
  for (const text of strings) { stringBytes += Buffer.byteLength(text); requireParser(stringBytes <= fileParserLimits.responseBytes); }
  requireParser(strings.length <= fileParserLimits.responseBytes && new Set(strings).size === strings.length);
  let used = 0, visited = 0;
  const reference = (index: unknown) => {
    requireParser(Number.isSafeInteger(index) && (index as number) >= 0 && (index as number) < strings.length && (index as number) <= used);
    if (index === used) used++;
    return strings[index as number]!;
  };
  const unpack = (input: unknown, depth: number): unknown => {
    requireParser(depth <= nestingLimit && ++visited <= fileParserLimits.responseBytes);
    if (visited % 256 === 1) check?.();
    if (typeof input === 'boolean') return input;
    if (typeof input === 'number') { requireParser(Number.isSafeInteger(input)); return input; }
    requireParser(Array.isArray(input) && input.length > 0);
    if (input[0] === 0) { requireParser(input.length === 2); return reference(input[1]); }
    if (input[0] === 2) return input.slice(1).map(child => unpack(child, depth + 1));
    requireParser(input[0] === 1); const output: Record<string, unknown> = {};
    for (const pair of input.slice(1)) {
      requireParser(Array.isArray(pair) && pair.length === 2); const key = reference(pair[0]);
      requireParser(!Object.hasOwn(output, key));
      Object.defineProperty(output, key, { value: unpack(pair[1], depth + 1), enumerable: true, configurable: true, writable: true });
    }
    return output;
  };
  const facts = unpack(value.value, 0); requireParser(used === strings.length); check?.();
  // The caller must still validate the exact CodeFacts shape, ownership and original ranges.
  return facts as CodeFacts;
}

export function validateParserInput(path: unknown, content: unknown): asserts path is string {
  requireParser(typeof path === 'string' && path.length > 0 && path.length <= 4096
    && !/[\\\u0000-\u001f\u007f]/.test(path) && !path.startsWith('/')
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'PARSER_INPUT');
  requireParser(typeof content === 'string' && Buffer.byteLength(content) <= fileParserLimits.contentBytes, 'PARSER_INPUT_LIMIT');
}
function binding(value: Record<string, unknown>) {
  requireParser(value.version === fileParserProtocol && generation(value.generation) && hex(value.identity));
}
function requestId(value: Record<string, unknown>) {
  requireParser(Number.isSafeInteger(value.id) && (value.id as number) > 0 && hex(value.digest));
}

/** Dedicated transferred buffers keep pooled backing stores out of the wire contract. */
export function encodeParserFrame(value: unknown, limit: number): ArrayBuffer {
  const json = JSON.stringify(value);
  requireParser(typeof json === 'string' && Buffer.byteLength(json) <= limit, 'PARSER_FRAME_LIMIT');
  const output = new ArrayBuffer(Buffer.byteLength(json)); new Uint8Array(output).set(Buffer.from(json)); return output;
}
export function encodeParserReply(value: ParserReply): ArrayBuffer {
  return encodeParserFrame(value.type === 'facts' ? { ...value, facts: packParserFacts(value.facts) } : value, fileParserLimits.responseBytes);
}
export function decodeParserFrame(value: unknown, limit: number): unknown {
  requireParser(value instanceof ArrayBuffer && value.byteLength > 0 && value.byteLength <= limit, 'PARSER_FRAME_LIMIT');
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value)) as unknown; }
  catch { throw new FileParserError('PARSER_PROTOCOL'); }
}
export function decodeParseRequest(frame: unknown): ParseRequest {
  const value = decodeParserFrame(frame, fileParserLimits.requestBytes);
  keys(value, ['version', 'generation', 'identity', 'type', 'id', 'path', 'content', 'digest']);
  binding(value); requestId(value); requireParser(value.type === 'parse');
  validateParserInput(value.path, value.content);
  requireParser(value.digest === fileParserDigest(value.path, value.content as string));
  return value as unknown as ParseRequest;
}
export function decodeParserReply(frame: unknown, check?: () => void): ParserReply {
  check?.();
  const value = decodeParserFrame(frame, fileParserLimits.responseBytes); requireParser(object(value));
  binding(value);
  const common = ['version', 'generation', 'identity', 'type'];
  if (value.type === 'ready') keys(value, common);
  else {
    keys(value, [...common, 'id', 'digest', value.type === 'facts' ? 'facts' : 'code']);
    requestId(value);
    requireParser(value.type === 'facts' || value.type === 'error'
      && ['PARSER_EXTRACTION_FAILED', 'PARSER_RESULT_LIMIT'].includes(value.code as string));
  }
  if (value.type === 'facts') value.facts = unpackParserFacts(value.facts, check);
  check?.(); return value as unknown as ParserReply;
}

/** Strict wire shape plus the existing fact ownership and UTF-16 range semantics. */
export function validateParserFacts(value: unknown, content: string): asserts value is CodeFacts {
  keys(value, ['symbols', 'operations', 'calls', 'records', 'gaps']);
  requireParser(Array.isArray(value.symbols) && Array.isArray(value.operations) && Array.isArray(value.calls)
    && dictionary(value.records) && Array.isArray(value.gaps) && value.gaps.every(gap => typeof gap === 'string'));
  const symbols = new Map<string, SymbolFact>();
  const range = (item: Record<string, unknown>) => requireParser(Number.isSafeInteger(item.start) && Number.isSafeInteger(item.end)
    && (item.start as number) >= 0 && (item.end as number) > (item.start as number) && (item.end as number) <= content.length);
  for (const symbol of value.symbols as unknown[]) {
    keys(symbol, ['key', 'name', 'qualifiedName', 'role', 'exported', 'start', 'end'], ['className', 'parameterTypes']);
    requireParser(['key', 'name', 'qualifiedName'].every(key => typeof symbol[key] === 'string')
      && ['function', 'vue-action', 'amd-function', 'java-method'].includes(symbol.role as string)
      && typeof symbol.exported === 'boolean' && !symbols.has(symbol.key as string)
      && (!Object.hasOwn(symbol, 'className') || typeof symbol.className === 'string')
      && (!Object.hasOwn(symbol, 'parameterTypes') || Array.isArray(symbol.parameterTypes) && symbol.parameterTypes.every(item => typeof item === 'string')));
    range(symbol); symbols.set(symbol.key as string, symbol as unknown as SymbolFact);
  }
  for (const operation of value.operations as unknown[]) {
    keys(operation, ['owner', 'kind', 'properties', 'start', 'end']); range(operation);
    requireParser(typeof operation.owner === 'string' && dictionary(operation.properties)
      && ['http-request', 'event-publish', 'event-subscribe', 'document-write'].includes(operation.kind as string));
    const owner = symbols.get(operation.owner);
    requireParser(owner && (operation.start as number) >= owner.start && (operation.end as number) <= owner.end);
  }
  for (const call of value.calls as unknown[]) {
    keys(call, ['owner', 'local', 'imported', 'module']);
    requireParser(['owner', 'local', 'imported', 'module'].every(key => typeof call[key] === 'string') && symbols.has(call.owner as string));
  }
}
