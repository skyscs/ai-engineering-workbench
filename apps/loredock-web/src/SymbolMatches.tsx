import type { CodeSymbolResult } from '../../loredock/src/code-symbol-types';

export function SymbolMatches({ value, error, loading, openEvidence }: { value?: CodeSymbolResult | undefined; error: string; loading: boolean; openEvidence(id: string): void }) {
  if (loading) return <p role="status">Checking supported symbols…</p>;
  if (!value && !error) return null;
  const coverage = value?.coverage;
  const details = <>
    {error && <p className="error">Symbol lookup failed: {error} Original text search is independent.</p>}
    {value?.reason && <p>{value.reason}</p>}
    {coverage && <p>{coverage.scannedFiles} of {coverage.retainedFiles} retained code files checked · {coverage.matchingSymbols} exact symbol matches
      {' · '}{coverage.omittedMatches} matches omitted · {coverage.filesWithSyntaxGaps} files with syntax gaps.</p>}
    {coverage?.timeStopped && <p>The lookup reached its time limit. Remaining files were not checked.</p>}
    {coverage?.outputLimited && <p>Some matches did not fit the response budget.</p>}
    {value && <p>{value.limitation}</p>}
  </>;
  if (!value?.matches.length) return <details className="symbol-coverage"><summary>Supported symbols: {error ? 'lookup failed' : value?.status === 'unavailable' ? 'unavailable' : 'no displayed matches'}</summary>{details}</details>;
  return <section className="symbol-matches" aria-label="Supported symbol matches"><h3>Supported symbols</h3>
    <p role="status">{value.matches.length} exact symbol matches for <code>{value.query}</code>. Source syntax, with original support.</p>
    <ul className="results">{value.matches.map(match => <li key={match.id} data-symbol-id={match.id}>
      <strong>{match.qualifiedName}</strong><p>{match.sourceName} / <code>{match.path}</code></p>
      <p className="muted">Lines {match.range.startLine}–{match.range.endLine} · {match.revision.slice(0, 8)} · {match.role.replaceAll('-', ' ')}</p>
      <div className="actions">{match.evidence.map(ref => <button key={ref.id} onClick={() => openEvidence(ref.id)}>Original lines {ref.startLine}–{ref.endLine}</button>)}</div>
    </li>)}</ul>
    <details className="symbol-coverage"><summary>Symbol coverage and limits</summary>{details}</details>
  </section>;
}
