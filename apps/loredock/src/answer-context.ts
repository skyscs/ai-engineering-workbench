import type { Catalog } from './catalog.js';
import { sha256 } from './extract.js';
import { CatalogError, type BuildSource, type Coverage } from './types.js';
import { searchText } from './search-text.js';
import { answerReviewContext, assertAnswerReviewCurrent, type AnswerReviewContext } from './answer-review.js';

export const retrievalVersion = 'fts-question-v6';
export const answerSchemaVersion = 'cited-answer-v3';
export const answerLimits = { spans: 30, textBytes: 64 * 1024, candidates: 120, claims: 20, outputBytes: 256 * 1024 } as const;
export interface InputSpan {
  id: string; sourceId: string; sourceName: string; revision: string; path: string;
  startLine: number; endLine: number; contentHash: string; spanHash: string; text: string;
}
export interface AnswerContext {
  question: string; buildId: string; policyVersion: number; sourceSetVersion: number; registryVersion: number;
  retrievalVersion: string; environment: 'unspecified'; deploymentCoherence: 'unknown';
  partial: boolean; stale: boolean; coverage: Coverage; sources: BuildSource[];
  terms: string[]; expansionTerms: string[];
  // Absent in saved contexts issued before fts-question-v4; keep their hashed bytes unchanged.
  retrievalMode?: 'lexical' | 'orientation' | 'empty'; spans: InputSpan[]; textBytes: number;
  // Missing on older immutable answer inputs; do not backfill their saved JSON.
  review?: AnswerReviewContext;
  limits: typeof answerLimits; gaps: string[]; inputHash: string;
}
export interface CitedAnswer {
  claims: { kind: 'fact' | 'inference' | 'conflict'; text: string; evidenceIds: string[] }[];
  unknowns: string[];
}

interface Candidate { id: string; bytes: number }
export const samplingLimits = { namedSpans: 12, perSource: 6 } as const;
const phrase = (value: string) => searchText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function namedSources(question: string, sources: BuildSource[]) {
  // Match complete identifier blocks or words: inventory-api-extra is not inventory-api.
  const blocks = (question.match(/[\p{L}\p{N}_.-]+/gu) ?? []).map(phrase).filter(Boolean);
  return sources.filter(source => {
    const name = phrase(source.name);
    return name && blocks.some((_, start) => {
      let candidate = '';
      for (let index = start; index < blocks.length && candidate.length < name.length; index++) {
        candidate += (candidate ? ' ' : '') + blocks[index];
        if (candidate === name) return true;
      }
      return false;
    });
  });
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
  const lookup = (expression: string, limit: number) => catalog.store.all<Candidate>(`SELECT s.id,length(CAST(s.text AS BLOB)) AS bytes FROM question_search
    JOIN spans s ON s.id=question_search.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE question_search MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active'
    ORDER BY rank,bs.rowid,f.path,s.startLine LIMIT ?`, expression, id, limit);
  const initial = expression ? lookup(expression, answerLimits.candidates + 1) : [];
  // One bounded expansion from literal identifiers in the strongest admitted matches.
  // This is a retrieval hint, never an inferred call graph or a relation claim.
  const symbols = new Map<string, number>();
  let inspectedBytes = 0;
  for (const candidate of initial.slice(0, 6)) {
    if (inspectedBytes + candidate.bytes > answerLimits.textBytes) continue;
    const evidence = catalog.evidence(candidate.id), bytes = Buffer.byteLength(evidence.text, 'utf8');
    inspectedBytes += bytes;
    for (const token of new Set(evidence.text.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:[A-Z][a-z]+)+|[A-Z]+(?:_[A-Z]+)+)\b/g) ?? [])) {
      if (token.length <= 80) symbols.set(token, (symbols.get(token) ?? 0) + 1);
    }
  }
  const expansionTerms = [...symbols].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([symbol]) => symbol);
  const expanded = expansionTerms.length ? lookup(expansionTerms.map(term => `"${term}"`).join(' OR '), answerLimits.candidates + 1) : [];
  // A full normalized source name is only an orientation hint, never an ownership claim.
  // Keep every matching identity, including duplicate display names, and balance samples.
  const named = namedSources(question, sources);
  const namedSample = named.length ? catalog.store.all<Candidate>(`WITH ranked AS (
    SELECT s.id,length(CAST(s.text AS BLOB)) AS bytes,bs.rowid AS sourceOrder,
      row_number() OVER (PARTITION BY f.sourceId ORDER BY CASE
        WHEN lower(f.path) IN ('readme','readme.md','readme.txt') THEN 0
        WHEN lower(f.path) IN ('package.json','pom.xml') THEN 1 ELSE 2 END,length(f.path),f.path) AS position
    FROM spans s JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND s.startLine=1
      AND f.sourceId IN (${named.map(() => '?').join(',')})
  ) SELECT id,bytes FROM ranked WHERE position<=? ORDER BY position,sourceOrder LIMIT ?`,
    id, ...named.map(source => source.sourceId), samplingLimits.perSource, samplingLimits.namedSpans + 1) : [];
  // Reserve a small source-orientation allowance for matched repositories' root README.
  const orientation = initial.length ? catalog.store.all<Candidate>(`SELECT s.id,length(CAST(s.text AS BLOB)) AS bytes FROM spans s
    JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND s.startLine=1
    AND lower(f.path) IN ('readme','readme.md','readme.txt')
    AND f.sourceId IN (SELECT f2.sourceId FROM spans s2 JOIN files f2 ON f2.id=s2.fileId WHERE s2.id IN (${initial.slice(0, 6).map(() => '?').join(',')}))
    ORDER BY bs.rowid,f.path LIMIT 3`, id, ...initial.slice(0, 6).map(item => item.id)) : [];
  // With no lexical foothold, sample repository orientation by indexed file metadata.
  // One first span per language/source, plus root README/manifests; never infer relations
  // from extensions or send an unbounded repository dump. Round-robin prevents starvation.
  const fallback = initial.length ? [] : catalog.store.all<Candidate>(`WITH classified AS (
    SELECT s.id,length(CAST(s.text AS BLOB)) AS bytes,f.sourceId,f.path,bs.rowid AS sourceOrder,CASE
      WHEN lower(f.path) IN ('readme','readme.md','readme.txt') THEN '0-readme'
      WHEN lower(f.path) IN ('package.json','pom.xml') THEN '1-manifest'
      WHEN json_extract(f.metadata,'$.kind') IN ('java','js','jsx','ts','tsx','vue','css','html','sql','sh','gradle')
        THEN '2-' || json_extract(f.metadata,'$.kind') END AS category
    FROM spans s JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND s.startLine=1
  ), representatives AS (
    SELECT *,row_number() OVER (PARTITION BY sourceId,category ORDER BY length(path),path) AS representative
    FROM classified WHERE category IS NOT NULL
  ), balanced AS (
    SELECT *,row_number() OVER (PARTITION BY sourceId ORDER BY category,path) AS position
    FROM representatives WHERE representative=1
  ) SELECT id,bytes FROM balanced WHERE position<=? ORDER BY position,sourceOrder,path LIMIT ?`, id, samplingLimits.perSource, answerLimits.candidates + 1);
  const candidates = [...new Map([...initial.slice(0, 6), ...namedSample.slice(0, samplingLimits.namedSpans), ...orientation, ...expanded, ...initial, ...fallback].map(candidate => [candidate.id, candidate])).values()];
  let budgetOmitted = false;
  for (const candidate of candidates.slice(0, answerLimits.candidates)) {
    // Consult stored span byte metadata before reopening a potentially large file.
    if (spans.length >= answerLimits.spans || textBytes + candidate.bytes > answerLimits.textBytes) { budgetOmitted = true; continue; }
    const evidence = catalog.evidence(candidate.id);
    const bytes = Buffer.byteLength(evidence.text, 'utf8');
    // Hash-equivalent files from different repositories remain separate evidence.
    const { sourceId, sourceName, revision, path, startLine, endLine, contentHash, spanHash, text } = evidence;
    spans.push({ id: evidence.id, sourceId, sourceName, revision, path, startLine, endLine, contentHash, spanHash, text });
    textBytes += bytes;
  }
  if (named.length) gaps.push(`Full repository names in the question select at most ${samplingLimits.perSource} first spans per matching source and ${samplingLimits.namedSpans} total. This is an orientation hint, not proof of relevance, ownership or complete coverage.`);
  if (namedSample.length > samplingLimits.namedSpans) gaps.push('The named-source sample limit omitted additional candidate passages.');
  const unrepresented = sources.filter(source => !spans.some(span => span.sourceId === source.sourceId));
  if (unrepresented.length) gaps.push(`No source passages are supplied from ${unrepresented.length} of ${sources.length} authorized indexed repositories: ${unrepresented.map(source => source.name).join(', ')}. This does not establish absence or irrelevance.`);
  if (!initial.length) gaps.push('No admitted lexical matches; this does not prove absence from the system.');
  if (fallback.length) gaps.push('Only a bounded repository-orientation sample is available; it is not a relevance match or complete language inventory.');
  if (candidates.length > answerLimits.candidates) gaps.push('The candidate limit omitted additional evidence candidates.');
  if (budgetOmitted) gaps.push('The span or UTF-8 text budget omitted candidate evidence.');
  if (build.status === 'partial') gaps.push('Index coverage is partial; excluded or failed material is not available.');
  if (build.sourceSetVersion !== project.sourceSetVersion) gaps.push('The source registry changed after this index was built.');
  gaps.push('Deployment environment and whether these revisions are deployed together are unknown.');
  // Coverage describes the complete historical build, including revoked source counts.
  const context = { question: question.trim(), buildId: id, policyVersion: build.policyVersion,
    sourceSetVersion: build.sourceSetVersion, registryVersion: project.sourceSetVersion, retrievalVersion, environment: 'unspecified' as const,
    deploymentCoherence: 'unknown' as const, partial: build.status === 'partial',
    stale: build.sourceSetVersion !== project.sourceSetVersion, coverage: build.coverage, sources,
    terms, expansionTerms, retrievalMode: spans.length ? initial.length ? 'lexical' as const : 'orientation' as const : 'empty' as const,
    spans, textBytes, limits: answerLimits, gaps, review: answerReviewContext(catalog, id, spans.map(span => span.id)) };
  return { ...context, inputHash: sha256(JSON.stringify(context)) };
}

export function citedAnswerSchema(context: AnswerContext) {
  const ids = context.spans.map(span => span.id);
  return {
    type: 'object', additionalProperties: false, required: ['claims', 'unknowns'],
    properties: {
      claims: { type: 'array', maxItems: ids.length ? answerLimits.claims : 0, items: {
        type: 'object', additionalProperties: false, required: ['kind', 'text', 'evidenceIds'],
        properties: { kind: { type: 'string', enum: ['fact', 'inference', 'conflict'] }, text: { type: 'string', minLength: 1, maxLength: 2000 },
          evidenceIds: { type: 'array', minItems: 1, maxItems: 10, items: ids.length ? { type: 'string', enum: ids } : { type: 'string' } } },
      } }, unknowns: { type: 'array', maxItems: 20, description: 'Unanswered questions only. Put known facts and explanations in cited claims.',
        items: { type: 'string', minLength: 2, maxLength: 2000, pattern: '\\?$' } },
    },
  };
}

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
    || value.claims.length > answerLimits.claims || value.unknowns.length > 20 || !value.unknowns.every(item => prose(item) && item.trim().length > 1 && item.endsWith('?'))
    || value.claims.length + value.unknowns.length === 0) throw invalid();
  // Fence the whole issued input, including spans the model did not cite.
  const { inputHash, ...input } = context;
  if (sha256(JSON.stringify(input)) !== inputHash) throw invalid();
  assertAnswerReviewCurrent(catalog, context.review);
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
