import type { Catalog } from './catalog.js';
import { sha256 } from './extract.js';
import { CatalogError, type BuildSource, type Coverage } from './types.js';
import { searchText } from './search-text.js';

export const retrievalVersion = 'fts-question-v3';
export const answerSchemaVersion = 'cited-answer-v1';
export const answerLimits = { spans: 30, textBytes: 64 * 1024, candidates: 120, claims: 20, outputBytes: 256 * 1024 } as const;
export interface InputSpan {
  id: string; sourceId: string; sourceName: string; revision: string; path: string;
  startLine: number; endLine: number; contentHash: string; spanHash: string; text: string;
}
export interface AnswerContext {
  question: string; buildId: string; policyVersion: number; sourceSetVersion: number; registryVersion: number;
  retrievalVersion: string; environment: 'unspecified'; deploymentCoherence: 'unknown';
  partial: boolean; stale: boolean; coverage: Coverage; sources: BuildSource[];
  terms: string[]; expansionTerms: string[]; spans: InputSpan[]; textBytes: number;
  limits: typeof answerLimits; gaps: string[]; inputHash: string;
}
export interface CitedAnswer {
  claims: { kind: 'fact' | 'inference' | 'conflict'; text: string; evidenceIds: string[] }[];
  unknowns: string[];
}

// Stop words only reduce lexical noise; this is not a semantic or language detector.
const stopWords = new Set('a an and are as at be by can do does for from how in is it of on or that the this to was what when where which who why with'.split(' '));
export function questionTerms(question: string): string[] {
  return [...new Set((searchText(question).match(/[\p{L}\p{N}_]+/gu) ?? []).filter(term => !stopWords.has(term)))].slice(0, 24);
}

/** Retrieve only authorized, immutable evidence. Never load the evaluation oracle. */
export function retrieveAnswerContext(catalog: Catalog, question: string, buildId?: string): AnswerContext {
  if (typeof question !== 'string' || !question.trim() || Buffer.byteLength(question, 'utf8') > 2000) throw new CatalogError('INVALID_QUESTION', 'Enter a question of at most 2,000 UTF-8 bytes.');
  const project = catalog.store.project(), id = buildId ?? project.publishedBuildId;
  if (!id) throw new CatalogError('NOT_READY', 'Index sources before asking a question.', 409);
  const build = catalog.store.build(id);
  if (!build.published) throw new CatalogError('NOT_READY', 'This index has not been published.', 409);
  if (build.policyVersion !== project.policyVersion) throw new CatalogError('POLICY_CHANGED', 'Index sources again after changing the policy.', 409);
  const sources = build.sources.filter(source => catalog.store.source(source.sourceId).status === 'active');
  const terms = questionTerms(question), spans: InputSpan[] = [], gaps: string[] = [];
  let textBytes = 0;
  if (sources.length !== build.sources.length) gaps.push('Revoked sources are excluded from this context.');
  const expression = terms.map(term => `"${term}"`).join(' OR ');
  const lookup = (expression: string, limit: number) => catalog.store.all<{ id: string }>(`SELECT s.id FROM question_search
    JOIN spans s ON s.id=question_search.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    WHERE question_search MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active'
    ORDER BY rank,f.sourceId,f.path,s.startLine LIMIT ?`, expression, id, limit);
  const initial = expression ? lookup(expression, answerLimits.candidates + 1) : [];
  // One bounded expansion from literal identifiers in the strongest admitted matches.
  // This is a retrieval hint, never an inferred call graph or a relation claim.
  const symbols = new Map<string, number>();
  let inspectedBytes = 0;
  for (const candidate of initial.slice(0, 6)) {
    const evidence = catalog.evidence(candidate.id), bytes = Buffer.byteLength(evidence.text, 'utf8');
    if (inspectedBytes + bytes > answerLimits.textBytes) continue;
    inspectedBytes += bytes;
    for (const token of new Set(evidence.text.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:[A-Z][a-z]+)+|[A-Z]+(?:_[A-Z]+)+)\b/g) ?? [])) {
      if (token.length <= 80) symbols.set(token, (symbols.get(token) ?? 0) + 1);
    }
  }
  const expansionTerms = [...symbols].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([symbol]) => symbol);
  const expanded = expansionTerms.length ? lookup(expansionTerms.map(term => `"${term}"`).join(' OR '), answerLimits.candidates + 1) : [];
  // Reserve a small source-orientation allowance for matched repositories' root README.
  const orientation = initial.length ? catalog.store.all<{ id: string }>(`SELECT s.id FROM spans s
    JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND s.startLine=1
    AND lower(f.path) IN ('readme','readme.md','readme.txt')
    AND f.sourceId IN (SELECT f2.sourceId FROM spans s2 JOIN files f2 ON f2.id=s2.fileId WHERE s2.id IN (${initial.slice(0, 6).map(() => '?').join(',')}))
    ORDER BY f.sourceId,f.path LIMIT 3`, id, ...initial.slice(0, 6).map(item => item.id)) : [];
  const candidates = [...new Map([...initial.slice(0, 6), ...orientation, ...expanded, ...initial].map(candidate => [candidate.id, candidate])).values()];
  let budgetOmitted = false;
  for (const candidate of candidates.slice(0, answerLimits.candidates)) {
    const evidence = catalog.evidence(candidate.id);
    const bytes = Buffer.byteLength(evidence.text, 'utf8');
    if (spans.length >= answerLimits.spans || textBytes + bytes > answerLimits.textBytes) { budgetOmitted = true; continue; }
    // Hash-equivalent files from different repositories remain separate evidence.
    const { sourceId, sourceName, revision, path, startLine, endLine, contentHash, spanHash, text } = evidence;
    spans.push({ id: evidence.id, sourceId, sourceName, revision, path, startLine, endLine, contentHash, spanHash, text });
    textBytes += bytes;
  }
  if (!spans.length) gaps.push('No admitted lexical matches; this does not prove absence from the system.');
  if (candidates.length > answerLimits.candidates) gaps.push('The lexical candidate limit omitted lower-ranked matches.');
  if (budgetOmitted) gaps.push('The span or UTF-8 text budget omitted matching evidence.');
  if (build.status === 'partial') gaps.push('Index coverage is partial; excluded or failed material is not available.');
  if (build.sourceSetVersion !== project.sourceSetVersion) gaps.push('The source registry changed after this index was built.');
  gaps.push('Deployment environment and whether these revisions are deployed together are unknown.');
  // Coverage describes the complete historical build, including revoked source counts.
  const context = { question: question.trim(), buildId: id, policyVersion: build.policyVersion,
    sourceSetVersion: build.sourceSetVersion, registryVersion: project.sourceSetVersion, retrievalVersion, environment: 'unspecified' as const,
    deploymentCoherence: 'unknown' as const, partial: build.status === 'partial',
    stale: build.sourceSetVersion !== project.sourceSetVersion, coverage: build.coverage, sources,
    terms, expansionTerms, spans, textBytes, limits: answerLimits, gaps };
  return { ...context, inputHash: sha256(JSON.stringify(context)) };
}

export const citedAnswerSchema = {
  type: 'object', additionalProperties: false, required: ['claims', 'unknowns'],
  properties: {
    claims: { type: 'array', maxItems: answerLimits.claims, items: {
      type: 'object', additionalProperties: false, required: ['kind', 'text', 'evidenceIds'],
      properties: { kind: { type: 'string', enum: ['fact', 'inference', 'conflict'] }, text: { type: 'string', minLength: 1, maxLength: 2000 },
        evidenceIds: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string' } } },
    } }, unknowns: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 2000 } },
  },
};

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function keys(value: Record<string, unknown>, expected: string[]) { return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)); }
function prose(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000; }

/** Mechanical validation only: a resolving citation does not prove semantic support. */
export function validateCitedAnswer(catalog: Catalog, context: AnswerContext, serialized: string): CitedAnswer {
  const invalid = (detail = 'Invalid shape, bounds or input integrity.') => new CatalogError('INVALID_ANSWER', `The answer does not match the issued evidence and answer schema. ${detail}`, 422);
  if (Buffer.byteLength(serialized, 'utf8') > answerLimits.outputBytes) throw invalid();
  let value: unknown;
  try { value = JSON.parse(serialized) as unknown; } catch { throw invalid(); }
  if (!record(value) || !keys(value, ['claims', 'unknowns']) || !Array.isArray(value.claims) || !Array.isArray(value.unknowns)
    || value.claims.length > answerLimits.claims || value.unknowns.length > 20 || !value.unknowns.every(prose)
    || value.claims.length + value.unknowns.length === 0) throw invalid();
  // Fence the whole issued input, including spans the model did not cite.
  const { inputHash, ...input } = context;
  if (sha256(JSON.stringify(input)) !== inputHash) throw invalid();
  const project = catalog.store.project();
  if (project.policyVersion !== context.policyVersion || project.sourceSetVersion !== context.registryVersion) throw new CatalogError('INPUT_CHANGED', 'The answer inputs are no longer current.', 409);
  const build = catalog.store.build(context.buildId);
  if (!build.published || build.policyVersion !== context.policyVersion || build.sourceSetVersion !== context.sourceSetVersion) throw invalid();
  const issued = new Set<string>();
  for (const span of context.spans) {
    const live = catalog.evidence(span.id);
    if (live.buildId !== context.buildId || live.contentHash !== span.contentHash || live.spanHash !== span.spanHash
      || live.text !== span.text || live.path !== span.path || live.sourceId !== span.sourceId || live.sourceName !== span.sourceName
      || live.startLine !== span.startLine || live.endLine !== span.endLine || live.revision !== span.revision) throw invalid();
    issued.add(span.id);
  }
  for (const claim of value.claims) {
    if (!record(claim) || !keys(claim, ['kind', 'text', 'evidenceIds']) || !['fact', 'inference', 'conflict'].includes(String(claim.kind))
      || !prose(claim.text) || !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length < 1 || claim.evidenceIds.length > 10) throw invalid('Invalid claim fields or citation count.');
    if (!claim.evidenceIds.every(id => typeof id === 'string' && issued.has(id))) throw invalid('A claim references an unissued citation.');
    if (new Set(claim.evidenceIds).size !== claim.evidenceIds.length) throw invalid('A claim repeats a citation.');
    if (claim.kind === 'conflict' && claim.evidenceIds.length < 2) throw invalid('A conflict needs two distinct citations.');
  }
  return value as unknown as CitedAnswer;
}
