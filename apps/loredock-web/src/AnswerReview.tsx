import type { AnswerReviewContext } from '../../loredock/src/answer-review';
import type { InputSpan } from '../../loredock/src/answer-context';

export function AnswerReview({ review, spans, openEvidence }: {
  review: AnswerReviewContext; spans: InputSpan[]; openEvidence(id: string): void;
}) {
  return <details className="answer-review">
    <summary>Engineer review in this context · {review.notes.length} {review.notes.length === 1 ? 'note' : 'notes'}</summary>
    <p className="muted">Human statements · unverified. These saved notes may dispute the source interpretation; they are not source facts or proof of deployment.</p>
    {review.notes.map(note => <article key={note.id} className="review-note">
      <h4>{note.action === 'dispute' ? 'Dispute' : 'Clarification'} · version {note.version}</h4>
      <p>{note.relationship.from} → {note.relationship.to} · {note.relationship.kind}</p>
      <p className="muted">Engineer scope: {note.environment ?? 'unspecified'} · original relationship scope: {note.relationship.environment ?? 'unspecified'}</p>
      <blockquote>{note.statement}</blockquote>
      {note.reappliedFrom && <p className="muted">Explicitly reapplied from an earlier index, review version {note.reappliedFrom.version}.</p>}
      <div className="citations">{note.matchingEvidenceIds.map(id => {
        const span = spans.find(span => span.id === id);
        return <button className="quiet" key={id} onClick={() => openEvidence(id)}>{span ? `${span.sourceName} / ${span.path}:${span.startLine}–${span.endLine}` : 'Open overlapping source'}</button>;
      })}</div>
    </article>)}
    <ul>{review.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
  </details>;
}
