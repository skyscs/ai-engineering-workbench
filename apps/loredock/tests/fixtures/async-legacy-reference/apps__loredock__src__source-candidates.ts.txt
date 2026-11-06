import type { Catalog } from './catalog.js';
import { retrieveAnswerContext, type AnswerContext } from './answer-context.js';
import { searchText } from './search-text.js';
import { sha256 } from './extract.js';
import { CatalogError } from './types.js';
import { candidateLinkContext, relatedPageOffset, type CandidateLinkContext } from './candidate-links.js';
import { answerReviewContext } from './answer-review.js';

export const candidateVersion = 'source-candidates-v1';
export const candidateLimits = { suggestions: 6, supportPerSource: 3, outputBytes: 128 * 1024 } as const;
export interface CandidateSupport {
  id: string; path: string; startLine: number; endLine: number; matchedTerms: string[];
}
export interface SourceCandidate {
  sourceId: string; sourceName: string; revision: string; score: number;
  support: CandidateSupport[]; omittedSupport: number;
}
export interface CandidateSelection {
  status: 'suggestions' | 'unresolved'; provenance: 'lexical'; verification: 'unverified';
  suggested: SourceCandidate[]; otherMatches: SourceCandidate[];
  representedSources: number; withoutDistinctiveMatch: number; distinctiveTerms: string[];
  omittedMatches: number; tiedAtLimit: boolean;
}
export interface CandidatePreview extends CandidateSelection {
  schemaVersion: 'source-candidate-preview-v1'; adapterVersion: typeof candidateVersion;
  question: string; buildId: string; inputHash: string; previewHash: string;
  policyVersion: number; sourceSetVersion: number; registryVersion: number;
  partial: boolean; stale: boolean; historical: boolean; sourceCount: number;
  coverage: AnswerContext['coverage']; review: AnswerContext['review'];
  related: CandidateLinkContext;
  gaps: string[]; limits: typeof candidateLimits;
}

/** Rank reading clues, never implementation ownership or causal confidence. */
export function selectSourceCandidates(context: Pick<AnswerContext, 'sources' | 'spans' | 'terms'>): CandidateSelection {
  const terms = [...new Set(context.terms.filter(term => [...term].length >= 3))];
  const owners = new Map(context.sources.map((source, order) => [source.sourceId, { source, order }]));
  const rows = context.spans.map((span, order) => {
    const owner = owners.get(span.sourceId);
    if (!owner || owner.source.name !== span.sourceName || owner.source.revision !== span.revision) {
      throw new CatalogError('INVALID_CONTEXT', 'A candidate passage does not match its recorded source.');
    }
    const words = new Set(searchText(`${span.path}\n${span.text}`).match(/[\p{L}\p{N}_]+/gu) ?? []);
    return { span, order, terms: new Set(terms.filter(term => words.has(term))) };
  });
  const represented = [...new Set(rows.map(row => row.span.sourceId))];
  const frequency = new Map(terms.map(term => [term, new Set(rows.filter(row => row.terms.has(term)).map(row => row.span.sourceId)).size]));
  const distinctiveTerms = terms.filter(term => frequency.get(term)! > 0 && frequency.get(term)! <= Math.max(1, Math.ceil(represented.length / 2)));
  const weights = new Map(distinctiveTerms.map(term => [term, Math.log(1 + represented.length / (1 + frequency.get(term)!))]));
  const score = (matched: string[]) => matched.reduce((sum, term) => sum + weights.get(term)!, 0);
  const candidates = represented.flatMap(sourceId => {
    const sourceRows = rows.filter(row => row.span.sourceId === sourceId);
    const matched = distinctiveTerms.filter(term => sourceRows.some(row => row.terms.has(term)));
    if (!matched.length) return [];
    const support = sourceRows.map(row => ({ ...row, matched: distinctiveTerms.filter(term => row.terms.has(term)) }))
      .filter(row => row.matched.length).sort((a, b) => score(b.matched) - score(a.matched) || a.order - b.order);
    const owner = owners.get(sourceId)!;
    return [{ sourceId, sourceName: owner.source.name, revision: support[0]!.span.revision, score: score(matched),
      support: support.slice(0, candidateLimits.supportPerSource).map(row => ({ id: row.span.id, path: row.span.path,
        startLine: row.span.startLine, endLine: row.span.endLine, matchedTerms: row.matched })),
      omittedSupport: support.length - Math.min(support.length, candidateLimits.supportPerSource) }];
  }).sort((a, b) => b.score - a.score || owners.get(a.sourceId)!.order - owners.get(b.sourceId)!.order);
  const eligible = candidates.filter(row => row.score >= (candidates[0]?.score ?? 0) * 0.6);
  const suggested = eligible.slice(0, candidateLimits.suggestions), selected = new Set(suggested.map(row => row.sourceId));
  return { status: suggested.length ? 'suggestions' : 'unresolved', provenance: 'lexical', verification: 'unverified',
    suggested, otherMatches: candidates.filter(row => !selected.has(row.sourceId)), representedSources: represented.length,
    withoutDistinctiveMatch: context.sources.length - candidates.length, distinctiveTerms,
    omittedMatches: candidates.length - suggested.length,
    tiedAtLimit: eligible.length > suggested.length && eligible[suggested.length]!.score === suggested.at(-1)!.score };
}

export function sourceCandidatePreview(catalog: Catalog, question: string, buildId?: string, pageOffset: unknown = 0): CandidatePreview {
  const offset = relatedPageOffset(pageOffset);
  const context = retrieveAnswerContext(catalog, question, buildId), selection = selectSourceCandidates(context);
  const related = candidateLinkContext(catalog, context, selection, offset);
  const review = answerReviewContext(catalog, context.buildId, [...context.spans.map(span => span.id),
    ...related.sources.flatMap(source => source.links.flatMap(link => link.evidence.map(ref => ref.id)))]);
  const result: Omit<CandidatePreview, 'previewHash'> = { schemaVersion: 'source-candidate-preview-v1', adapterVersion: candidateVersion,
    ...selection, question: context.question, buildId: context.buildId, inputHash: context.inputHash,
    policyVersion: context.policyVersion, sourceSetVersion: context.sourceSetVersion, registryVersion: context.registryVersion,
    partial: context.partial, stale: context.stale, historical: context.buildId !== catalog.state().publishedBuildId,
    sourceCount: context.sources.length, coverage: context.coverage, review, related, limits: candidateLimits,
    gaps: [...context.gaps,
      'Lexical matches are reading clues, including negative mentions. They do not establish implementation ownership, root cause or a repository to modify.',
      'Missing implementations, external systems and runtime evidence can change the investigation scope. These suggestions require source review.',
      'Distinctiveness is measured only within the bounded retrieved sample; omitted sources and passages may be relevant.',
      ...selection.tiedAtLimit ? ['Equally scored candidates cross the suggestion limit. Inspect other matches before narrowing the scope.'] : [],
    ] };
  const preview = { ...result, previewHash: sha256(JSON.stringify(result)) };
  if (Buffer.byteLength(JSON.stringify(preview)) > candidateLimits.outputBytes) {
    throw new CatalogError('OUTPUT_LIMIT', 'The candidate preview exceeds its output limit. Narrow the question.');
  }
  return preview;
}
