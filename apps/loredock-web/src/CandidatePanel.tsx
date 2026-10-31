import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CandidatePreview, SourceCandidate } from '../../loredock/src/source-candidates';
import { api } from './api';
import { AnswerReview } from './AnswerReview';
import { CandidateLinks } from './CandidateLinks';

export function CandidatePanel({ buildId, boundary, correctionRevision, openEvidence, clearEvidence }: {
  buildId: string; boundary: string; correctionRevision: number; openEvidence(id: string): void; clearEvidence(): void;
}) {
  const key = `${boundary}:${buildId}:${correctionRevision}`, currentKey = useRef(key); currentKey.current = key;
  const request = useRef(0), [question, setQuestion] = useState(''), [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ key: string; question: string; value: CandidatePreview }>();
  const [error, setError] = useState<{ key: string; text: string }>();
  useEffect(() => { request.current++; setBusy(false); clearEvidence(); return () => { request.current++; }; }, [key, clearEvidence]);
  const value = result?.key === key && result.question === question ? result.value : undefined;
  function edit(text: string) { request.current++; setQuestion(text); setResult(undefined); setError(undefined); setBusy(false); clearEvidence(); }
  async function preview(event: FormEvent) {
    event.preventDefault(); if (busy || !buildId || !question.trim()) return;
    const sequence = ++request.current; setBusy(true); setError(undefined); setResult(undefined); clearEvidence();
    try {
      const response = await api<CandidatePreview>('/candidates/preview', 'POST', { question, buildId });
      if (sequence === request.current && key === currentKey.current) setResult({ key, question, value: response });
    } catch (cause) {
      if (sequence === request.current && key === currentKey.current) setError({ key, text: (cause as Error).message });
    } finally { if (sequence === request.current && key === currentKey.current) setBusy(false); }
  }
  function card(candidate: SourceCandidate) {
    return <article className="source-candidate" key={candidate.sourceId} data-source-id={candidate.sourceId}>
      <h4>{candidate.sourceName}</h4><p className="muted">Saved revision {candidate.revision.slice(0, 8)}</p>
      {candidate.support.map(support => <div className="candidate-support" key={support.id}>
        <p>Matching terms: {support.matchedTerms.join(', ')}</p>
        <button className="quiet" onClick={() => openEvidence(support.id)}>{support.path}:{support.startLine}–{support.endLine}</button>
      </div>)}
      {candidate.omittedSupport > 0 && <p className="muted">{candidate.omittedSupport} additional matching passages are outside this card's reading sample.</p>}
    </article>;
  }
  return <section className="panel candidate-panel" aria-label="Source candidates" data-build-id={value?.buildId}>
    <h2>Where should I look?</h2>
    <p>Describe a problem or name a symbol, endpoint or event. Start with suggested repositories and check their original evidence.</p>
    <form onSubmit={event => void preview(event)}>
      <label htmlFor="candidate-question">Problem or source clue</label>
      <textarea id="candidate-question" rows={3} maxLength={2000} value={question}
        placeholder="For example: an event consumer stopped updating a projection" onChange={event => edit(event.target.value)} />
      <button className="primary" disabled={busy || !buildId || !question.trim()}>{busy ? 'Finding source clues…' : 'Find candidate repositories'}</button>
    </form>
    {!buildId && <p className="muted">Index sources to find candidate repositories. No AI setup is needed.</p>}
    {error?.key === key && <p className="error" role="alert">{error.text}</p>}
    {value && <div className="candidate-preview">
      <p role="status">{value.status === 'suggestions' ? `${value.suggested.length} source ${value.suggested.length === 1 ? 'suggestion' : 'suggestions'} to review` : 'No distinctive source match'}</p>
      <p className="muted">Local text matches · unverified. A matching or negative mention is a reading clue, not a confirmed cause or a repository to modify.</p>
      {value.status === 'unresolved' && <p className="notice">Try a more specific symbol, endpoint or phrase from your sources. Missing matches do not prove that an implementation is absent.</p>}
      {(value.stale || value.historical) && <p className="notice">These suggestions use an older index or source registry. Evidence stays pinned to that snapshot; update knowledge to include newer sources.</p>}
      {value.tiedAtLimit && <p className="notice">Equally matched sources extend beyond the suggestion limit. Inspect other matches before narrowing the scope.</p>}
      <div className="candidate-suggestions">{value.suggested.map(card)}</div>
      <CandidateLinks value={value.related} openEvidence={openEvidence} />
      {value.otherMatches.length > 0 && <details className="candidate-other"><summary>Other matches · {value.otherMatches.length} repositories</summary>
        <p>These sources fall below the selection threshold or outside the six-suggestion limit. They may still be relevant.</p>
        {value.otherMatches.map(card)}
      </details>}
      {value.review && (value.review.matching > 0 || value.review.unmatched > 0) && <AnswerReview review={value.review} spans={[]} openEvidence={openEvidence} />}
      <details className="candidate-coverage"><summary>Scope and missing context</summary>
        <p>Passages from {value.representedSources} of {value.sourceCount} indexed repositories were considered. {value.withoutDistinctiveMatch} have no distinctive match in this bounded sample.</p>
        <p>{value.coverage.indexed} indexed files · {value.coverage.excluded} excluded · {value.coverage.failed} failed. Deployment and missing external implementations remain unverified.</p>
        <ul>{value.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
        <p className="muted">{value.adapterVersion} · no model calls · suggestions do not change the broader answer context.</p>
      </details>
    </div>}
  </section>;
}
