import type { Catalog } from './catalog.js';
import { sha256 } from './extract.js';
import { CatalogError, type BuildSource, type Coverage } from './types.js';

export const retrievalVersion = 'fts-question-v1';
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
  terms: string[]; spans: InputSpan[]; textBytes: number;
  limits: typeof answerLimits; gaps: string[]; inputHash: string;
}
export interface CitedAnswer {
  claims: { kind: 'fact' | 'inference' | 'conflict'; text: string; evidenceIds: string[] }[];
  unknowns: string[];
}

// Stop words only reduce lexical noise; this is not a semantic or language detector.
const stopWords = new Set('a an and are as at be by can do does for from how in is it of on or that the this to was what when where which who why with'.split(' '));
export function questionTerms(question: string): string[] {
  return [...new Set((question.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter(term => !stopWords.has(term)))].slice(0, 24);
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
  const candidates = expression ? catalog.store.all<{ id: string }>(`SELECT s.id FROM search
    JOIN spans s ON s.id=search.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    WHERE search MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active'
    ORDER BY rank,s.id LIMIT ?`, expression, id, answerLimits.candidates + 1) : [];
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
    terms, spans, textBytes, limits: answerLimits, gaps };
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
  const invalid = () => new CatalogError('INVALID_ANSWER', 'The answer does not match the issued evidence and answer schema.', 422);
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
      || !prose(claim.text) || !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length < 1 || claim.evidenceIds.length > 10
      || !claim.evidenceIds.every(id => typeof id === 'string' && issued.has(id)) || new Set(claim.evidenceIds).size !== claim.evidenceIds.length
      || (claim.kind === 'conflict' && claim.evidenceIds.length < 2)) throw invalid();
  }
  return value as unknown as CitedAnswer;
}
