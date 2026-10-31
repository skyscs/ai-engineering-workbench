import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import type { CodeFacts, CodeRange } from './code-facts.js';
import type { FactRanges } from './code-analysis-types.js';

function valid(value: unknown): asserts value {
  if (!value) throw new CatalogError('CORRUPT_CODE_FACTS', 'Code facts do not match their original ranges or schema.', 409);
}
const dictionary = (value: unknown): value is Record<string, string> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value).every(item => typeof item === 'string'));

/** Validate text-only parser output, including values restored from a disposable checkpoint. */
export function factRanges(content: string, value: unknown): FactRanges {
  valid(value && typeof value === 'object');
  const facts = value as CodeFacts;
  valid(Array.isArray(facts.symbols) && Array.isArray(facts.operations) && Array.isArray(facts.calls)
    && dictionary(facts.records) && Array.isArray(facts.gaps) && facts.gaps.every(gap => typeof gap === 'string'));
  const keys = new Set<string>();
  function range(fact: CodeRange) {
    valid(Number.isSafeInteger(fact.start) && Number.isSafeInteger(fact.end) && fact.start >= 0 && fact.end > fact.start && fact.end <= content.length);
    return { startLine: content.slice(0, fact.start).split('\n').length, endLine: content.slice(0, fact.end - 1).split('\n').length,
      textHash: sha256(content.slice(fact.start, fact.end)) };
  }
  const symbols = facts.symbols.map(symbol => {
    valid(symbol && typeof symbol.key === 'string' && typeof symbol.name === 'string' && typeof symbol.qualifiedName === 'string'
      && ['function', 'vue-action', 'amd-function', 'java-method'].includes(symbol.role) && typeof symbol.exported === 'boolean'
      && (symbol.className === undefined || typeof symbol.className === 'string')
      && (symbol.parameterTypes === undefined || (Array.isArray(symbol.parameterTypes) && symbol.parameterTypes.every(type => typeof type === 'string')))
      && !keys.has(symbol.key)); keys.add(symbol.key);
    return { key: symbol.key, ...range(symbol) };
  });
  const operations = facts.operations.map(operation => {
    valid(operation && typeof operation.owner === 'string' && dictionary(operation.properties)
      && ['http-request', 'event-publish', 'event-subscribe', 'document-write'].includes(operation.kind));
    const owner = facts.symbols.find(symbol => symbol.key === operation.owner);
    valid(owner && operation.start >= owner.start && operation.end <= owner.end);
    return { owner: operation.owner, kind: operation.kind, ...range(operation) };
  });
  for (const call of facts.calls) valid(call && keys.has(call.owner) && [call.local, call.imported, call.module].every(item => typeof item === 'string'));
  return { offsetEncoding: 'UTF-16 code units', symbols, operations };
}

export function verifyFactRanges(content: string, facts: unknown, ranges: unknown) { valid(isDeepStrictEqual(factRanges(content, facts), ranges)); }

let fingerprint: string | undefined;
/** Hash installed implementation bytes; no project configuration or source module is loaded. */
export function codeAnalysisFingerprint() {
  if (!fingerprint) {
    const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
    const modules = ['code-typescript', 'code-java', 'code-facts', 'http-headers', 'code-analysis', 'code-analysis-facts', 'code-analysis-types', 'map-document', 'extract'];
    const hashes = modules.map(name => [name, sha256(readFileSync(new URL(`./${name}${extension}`, import.meta.url)))]);
    hashes.push(['typescript', sha256(readFileSync(createRequire(import.meta.url).resolve('typescript')))]);
    fingerprint = sha256(JSON.stringify({ version: 'loredock-file-facts/1', node: process.versions.node, hashes }));
  }
  return fingerprint;
}
