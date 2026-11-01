import { setImmediate as yieldTurn } from 'node:timers/promises';
import type { CodeAnalysis } from './code-analysis.js';
import type { SymbolFact } from './code-facts.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import { codeSymbolLimits, type CodeSymbolMatch, type CodeSymbolResult } from './code-symbol-types.js';

function matchesName(symbol: SymbolFact, query: string) {
  if (symbol.name === query || symbol.qualifiedName === query || symbol.className === query) return true;
  if (symbol.role !== 'java-method' || !symbol.className || symbol.qualifiedName !== `${symbol.className}.${symbol.name}`) return false;
  const shortClass = symbol.className.slice(symbol.className.lastIndexOf('.') + 1);
  return shortClass !== '' && (query === shortClass || query === `${shortClass}.${symbol.name}`);
}

export async function lookupCodeSymbols(analysis: CodeAnalysis, input: string, buildId?: string, overrides: Partial<typeof codeSymbolLimits> = {}): Promise<CodeSymbolResult> {
  const limits = { ...codeSymbolLimits, ...overrides };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < (key === 'outputBytes' ? 4096 : 0) || limits[key] > codeSymbolLimits[key]) {
      throw new CatalogError('INVALID_LIMIT', 'Symbol lookup limits may only reduce the default bounds.');
    }
  }
  if (typeof input !== 'string' || !input.trim() || Buffer.byteLength(input) > limits.queryBytes) throw new CatalogError('INVALID_QUERY', 'Enter an exact symbol name of at most 200 UTF-8 bytes.');
  const query = input.trim(), catalog = analysis.catalog, id = buildId ?? catalog.store.project().publishedBuildId;
  if (!id) throw new CatalogError('NOT_READY', 'Index sources before looking up symbols.', 409);
  catalog.readBuildHeader(id);
  const result: CodeSymbolResult = { schemaVersion: 'loredock-code-symbols/2', buildId: id, query, status: 'unavailable', reason: null, inventory: null,
    limits, matches: [], partial: true, coverage: null,
    limitation: 'Exact supported source syntax only. No match does not establish absence; unsupported code and runtime behavior remain unknown.' };
  const inventory = analysis.list().find(run => run.buildId === id && run.published && run.currentParser);
  if (!inventory) { result.reason = 'No compatible published code inventory is available for this index. Analyze code first.'; return result; }
  const began = performance.now(), snapshot = analysis.snapshot(inventory.id), buckets = new Map<string, CodeSymbolMatch[]>();
  const coverage = { candidateFiles: inventory.candidates, retainedFiles: snapshot.fileIds.length, scannedFiles: 0, scanComplete: false, timeStopped: false,
    matchedFiles: 0, matchingSymbols: 0, matchedSources: 0, omittedMatches: 0, outputLimited: false,
    filesWithSyntaxGaps: inventory.filesWithGaps, syntaxGapMessages: inventory.gaps, excluded: inventory.counts.excluded ?? 0,
    failed: inventory.counts.failed ?? 0, unattempted: inventory.counts.unattempted ?? 0, omitted: inventory.counts.omitted ?? 0 };
  for (const fileId of snapshot.fileIds) {
    if (performance.now() - began >= limits.wallMs) { coverage.timeStopped = true; break; }
    const file = analysis.file(inventory.id, fileId); coverage.scannedFiles++;
    const matching = file.facts.symbols.filter(symbol => matchesName(symbol, query)).sort((a, b) => a.start - b.start);
    if (matching.length) coverage.matchedFiles++;
    for (const symbol of matching) {
      coverage.matchingSymbols++;
      const bucket = buckets.get(file.sourceId) ?? []; buckets.set(file.sourceId, bucket);
      if (bucket.length >= limits.matches) continue;
      const range = file.ranges.symbols.find(range => range.key === symbol.key)!;
      const evidence = file.evidence.filter(ref => ref.startLine <= range.endLine && ref.endLine >= range.startLine);
      if (!evidence.length) throw new CatalogError('CORRUPT_CODE_FACTS', 'Symbol support does not overlap its original source range.', 409);
      bucket.push({ id: sha256(JSON.stringify([inventory.id, fileId, symbol.key, range.textHash])), fileId, sourceId: file.sourceId,
        sourceName: file.sourceName, path: file.path, revision: file.revision, blob: file.blob, contentHash: file.contentHash,
        name: symbol.name, qualifiedName: symbol.qualifiedName, role: symbol.role,
        range: { startLine: range.startLine, endLine: range.endLine, textHash: range.textHash }, evidence, status: 'syntax-only' });
    }
    await yieldTurn();
  }
  coverage.scanComplete = coverage.scannedFiles === snapshot.fileIds.length; coverage.matchedSources = buckets.size;
  result.status = 'available'; result.inventory = { id: inventory.id, fingerprint: inventory.fingerprint, policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion };
  result.coverage = coverage;
  const candidates: CodeSymbolMatch[] = [];
  for (let round = 0; round < limits.matches && candidates.length < limits.matches; round++) {
    for (const bucket of buckets.values()) if (bucket[round] && candidates.length < limits.matches) candidates.push(bucket[round]!);
  }
  // Reserve the final counters/flags before admitting each bounded match.
  for (const candidate of candidates) {
    result.matches.push(candidate); coverage.omittedMatches = coverage.matchingSymbols;
    coverage.outputLimited = false; result.partial = false;
    if (Buffer.byteLength(JSON.stringify(result)) > limits.outputBytes) { result.matches.pop(); coverage.outputLimited = true; break; }
    coverage.outputLimited = false;
  }
  coverage.omittedMatches = coverage.matchingSymbols - result.matches.length;
  result.partial = inventory.status === 'partial' || !coverage.scanComplete || coverage.omittedMatches > 0;
  const current = analysis.snapshot(inventory.id);
  if (current.manifestHash !== snapshot.manifestHash || current.policyVersion !== snapshot.policyVersion || current.registryVersion !== snapshot.registryVersion) {
    throw new CatalogError('ANALYSIS_FENCED', 'Code inventory changed during lookup. Search again.', 409);
  }
  if (Buffer.byteLength(JSON.stringify(result)) > limits.outputBytes) throw new CatalogError('OUTPUT_LIMIT', 'Symbol lookup metadata exceeds its response limit.', 409);
  return result;
}
