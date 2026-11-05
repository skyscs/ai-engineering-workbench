import { createHash } from 'node:crypto';
import type { CodeFacts, SymbolFact } from './code-facts.js';

export const fileParserProtocol = 'loredock-file-parser/1';
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
export function decodeParserReply(frame: unknown): ParserReply {
  const value = decodeParserFrame(frame, fileParserLimits.responseBytes); requireParser(object(value));
  const common = ['version', 'generation', 'identity', 'type'];
  if (value.type === 'ready') keys(value, common);
  else {
    keys(value, [...common, 'id', 'digest', value.type === 'facts' ? 'facts' : 'code']);
    requestId(value);
    requireParser(value.type === 'facts' || value.type === 'error'
      && ['PARSER_EXTRACTION_FAILED', 'PARSER_RESULT_LIMIT'].includes(value.code as string));
  }
  binding(value); return value as unknown as ParserReply;
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
