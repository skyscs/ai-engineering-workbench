import type { NativeQuestionCompact } from '../../loredock/src/question-preparation-types';
import type { InputSpan } from '../../loredock/src/answer-context';

const omissions: Record<string, string> = {
  INVENTORY_UNAVAILABLE: 'Code analysis is not available for this index.',
  QUESTION_AMBIGUOUS: 'Several code paths match this question; none was chosen automatically.',
  QUESTION_INSUFFICIENT_CONTEXT: 'The question does not identify a supported code path.',
  QUESTION_SELECTION_LIMIT: 'Code path selection reached its limit.',
  'no-complete-path': 'No complete supported path fits this context.',
  'incomplete-original-support': 'Some original passages needed for this path are outside the retrieved context.',
  'derived-size': 'The path does not fit alongside the existing interface comparisons.',
  'prompt-size': 'The path does not fit within the answer input limit.',
};
export function NativeQuestionContext({ value, spans, openEvidence }: {
  value: NativeQuestionCompact; spans: InputSpan[]; openEvidence(id: string): void;
}) {
  const item = value.item;
  if (!item) return <div className="notice native-question-context"><strong>No additional code path</strong>
    <p>{omissions[value.reason ?? ''] ?? 'No supported code path was included.'} The rest of the reviewed context is unchanged.</p></div>;
  const evidence = (ids: string[]) => ids.flatMap(id => { const span = spans.find(row => row.id === id);
    return span ? [<button className="quiet" key={id} onClick={() => openEvidence(id)}>{span.sourceName} / {span.path}:{span.startLine}–{span.endLine}</button>] : []; });
  return <details className="native-question-context">
    <summary>Related code context · static and unverified</summary>
    <h4>{item.flow.title}</h4>
    <p>This partial path describes indexed code. Deployment coherence is unknown and current applicability has not been checked. Verify the original passages before relying on a relationship.</p>
    <ol>{item.flow.edgeIndexes.map(index => { const edge = item.edges[index]; return edge && <li key={index}>
      <strong>{item.nodes[edge[1]]?.[1]} → {item.nodes[edge[2]]?.[1]}</strong>
      <p>{edge[0]} · {edge[3]} · {edge[4]}{edge[5] ? ` · ${edge[5]}` : ''}</p>
      {edge[8] && !edge[4].includes(edge[8].detail) && <p>{edge[8].detail}</p>}
      {edge[9] && <p>Static topic: {edge[9].value}. Runtime delivery is not established.</p>}
      <ul>{edge[6].map((gap, position) => <li key={position}>{gap}</li>)}</ul>
      <div className="citations">{evidence(edge[7].map(i => item.originals[i]!).filter(Boolean))}</div>
    </li>; })}</ol>
    <ul>{[...new Set([...item.flow.gaps, ...item.gaps])].map((gap, index) => <li key={index}>{gap}</li>)}</ul>
    <p>{Object.values(item.omissions).reduce((sum, n) => sum + n, 0)} path elements omitted · {Object.values(item.declarationOmissions).reduce((sum, n) => sum + n, 0)} declaration elements omitted.</p>
    {!!item.duplicateClues.length && <p>{item.duplicateClues.length} relationships overlap existing interface comparisons. They are repeated clues, not independent corroboration.</p>}
    <details><summary>Original passages supporting this path</summary><div className="citations">{evidence(item.originals)}</div></details>
  </details>;
}
