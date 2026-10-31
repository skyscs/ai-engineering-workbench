import type { AnswerInterfaces as InterfaceContext } from '../../loredock/src/answer-interfaces';
import type { InputSpan } from '../../loredock/src/answer-context';

export function AnswerInterfaces({ value, spans, openEvidence }: {
  value: InterfaceContext; spans: InputSpan[]; openEvidence(id: string): void;
}) {
  return <details className="answer-interfaces" open={value.comparisons.some(item => item.headerCheck.status === 'gap')}>
    <summary>Interface comparisons in this context · {value.comparisons.length}</summary>
    <p className="muted">Derived static analysis · unverified. Read both originals before relying on a relationship. These comparisons are supplied separately from source evidence and engineer notes.</p>
    {value.comparisons.map(item => <article className="interface-comparison" key={item.id}>
      <h4>{item.from.sourceName} → {item.to.sourceName} · {item.from.label}</h4>
      <p><strong>{item.headerCheck.status === 'match' ? 'Names match' : item.headerCheck.status === 'gap' ? 'Mapping not shown' : 'Not resolved'}</strong> · {item.headerCheck.detail}</p>
      <div className="citations">{item.evidenceIds.map(id => {
        const span = spans.find(span => span.id === id)!;
        return <button className="quiet" key={id} onClick={() => openEvidence(id)}>{span.sourceName} / {span.path}:{span.startLine}–{span.endLine}</button>;
      })}</div>
    </article>)}
    {!value.comparisons.length && <p>No complete supported HTTP comparison was included. This does not establish absence of interfaces or mismatches.</p>}
    <p>{value.omitted} complete comparisons omitted by count/byte/prompt limits · {value.incomplete} with incomplete source support · {value.unrelated} without source overlap.</p>
    {(Object.keys(value.graphOmissions).length > 0 || Object.keys(value.declarationOmissions).length > 0) && <p>Graph analysis also omitted work; inspect map coverage and gaps.</p>}
    <ul>{value.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
    <p className="muted">{value.codeAdapter} · {value.declarationAdapter} · {value.schemaVersion}</p>
  </details>;
}
