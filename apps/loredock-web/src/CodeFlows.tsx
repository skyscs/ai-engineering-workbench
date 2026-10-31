import { useEffect, useState } from 'react';
import type { CodeFlows } from '../../loredock/src/code-flow-types';
import { api } from './api';
import type { CorrectionOverlay } from '../../loredock/src/correction-types';
import { LinkCorrection } from './LinkCorrection';

export function CodeFlowsView({ buildId, boundary, openEvidence, overlay, reviewReady, correctionsChanged }: {
  buildId: string; boundary: string; openEvidence(id: string): void; overlay: CorrectionOverlay | undefined;
  reviewReady: boolean; correctionsChanged(): void;
}) {
  const key = `${boundary}:${buildId}`;
  const [result, setResult] = useState<{ key: string; value: CodeFlows }>();
  const [error, setError] = useState<{ key: string; text: string }>();
  useEffect(() => {
    let stopped = false;
    void api<CodeFlows>(`/code-flows?buildId=${encodeURIComponent(buildId)}`).then(value => {
      if (!stopped) { setResult({ key, value }); setError(undefined); }
    }).catch(cause => { if (!stopped) { setResult(undefined); setError({ key, text: (cause as Error).message }); } });
    return () => { stopped = true; };
  }, [buildId, key]);
  const value = result?.key === key ? result.value : undefined;
  function citations(ids: string[]) {
    return <div className="flow-citations">{ids.map(id => { const ref = value?.evidence[id]; return ref && <button className="quiet" key={id}
      onClick={() => openEvidence(id)}>{ref.sourceName} / {ref.path}:{ref.startLine}–{ref.endLine}</button>; })}</div>;
  }
  return <div className="code-flows">
    <h3>Static flow outlines</h3>
    <p className="muted">Follow supported code paths and open the original source. These partial outlines do not establish execution order, a shared broker or a deployed environment.</p>
    {error?.key === key ? <p className="error" role="alert">{error.text}</p> : !value ? <p role="status">Reading indexed code…</p> : <>
      <p role="status">{value.flows.length} static flow outline{value.flows.length === 1 ? '' : 's'} · {value.edges.filter(edge => edge.status === 'candidate').length} candidate code links</p>
      {value.stale && <p className="notice">These flows use an older index or source registry. Removed sources are excluded.</p>}
      {!reviewReady && <p className="notice">Checking engineer corrections. The review status below may be out of date.</p>}
      <details className="flow-header-checks" open={value.edges.some(edge => edge.headerCheck?.status === 'gap')}>
        <summary>HTTP header bindings ({value.edges.filter(edge => edge.headerCheck).length} candidate links)</summary>
        <p className="muted">Compare literal client header names with route declarations, including links outside the two outlines.
          A missing declaration is not a confirmed runtime defect. Header values, middleware, deployment and identity enforcement remain unverified.</p>
        {value.edges.filter(edge => edge.headerCheck).map(edge => {
          const from = value.nodes.find(node => node.id === edge.from)!, to = value.nodes.find(node => node.id === edge.to)!;
          return <section className="flow-header-check" key={edge.id}>
            <h4>{from.sourceName} → {to.sourceName} · {from.label}</h4>
            <p><strong>{edge.headerCheck!.status === 'match' ? 'Names match' : edge.headerCheck!.status === 'gap' ? 'Mapping not shown' : 'Not resolved'}</strong> · {edge.headerCheck!.detail}</p>
            {citations(edge.evidenceIds)}
            <LinkCorrection buildId={buildId} targetKind="code-link" targetId={edge.id} projectionHash={value.inputHash}
              overlay={overlay} ready={reviewReady} changed={correctionsChanged} openEvidence={openEvidence} />
          </section>;
        })}
        {!value.edges.some(edge => edge.headerCheck) && <p>No supported request/route candidate was available for this comparison.</p>}
      </details>
      {value.flows.map((flow, index) => {
        const affected = overlay?.corrections.filter(item => item.action !== 'withdraw' && item.affectedFlowIds.includes(flow.id)) ?? [];
        return <details className={`flow-card${affected.length ? ' needs-review' : ''}`} key={flow.id} open={index === 0}>
        <summary>{flow.title} <span className="tag">{affected.length ? 'Needs review' : reviewReady ? 'Partial' : 'Review pending'}</span></summary>
        {affected.length > 0 && <p className="notice flow-review-message">An engineer corrected a relationship used by this outline or its supporting evidence. Review the corrections before relying on the original path.</p>}
        <ol className="flow-steps">{flow.nodeIds.map((id, position) => {
          const node = value.nodes.find(node => node.id === id)!, incoming = position > 0 ? value.edges.find(edge => edge.id === flow.edgeIds[position - 1]) : undefined;
          return <li key={id}>
            {incoming?.status === 'candidate' && <p className="notice flow-candidate"><strong>Candidate hop</strong> · {incoming.reason}
              {incoming.environment && <span> · comparison scope: {incoming.environment}; active environment unknown</span>}</p>}
            <strong>{node.label}</strong><span className="muted"> · {node.sourceName}</span>
            {incoming?.status === 'static' && <details className="flow-link"><summary>Source link</summary><p>{incoming.reason}</p></details>}
            {citations(node.evidenceIds)}
            {incoming?.status === 'candidate' && <details className="flow-link"><summary>Compare hop evidence</summary>{citations(incoming.evidenceIds)}</details>}
            {incoming && <LinkCorrection buildId={buildId} targetKind="code-link" targetId={incoming.id} projectionHash={value.inputHash}
              overlay={overlay} ready={reviewReady} changed={correctionsChanged} openEvidence={openEvidence} />}
          </li>;
        })}</ol>
        <details className="flow-gaps"><summary>Unresolved wiring ({flow.gaps.length})</summary><ul>{flow.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></details>
      </details>; })}
      {!value.flows.length && <p>No supported client path could be linked in this bounded index. This does not establish absence of flows. Search source text and inspect coverage.</p>}
      <details className="flow-coverage"><summary>Code coverage and gaps</summary>
        <p>{value.coverage.examinedDocuments} / {value.coverage.candidateDocuments} candidate code files examined · {value.coverage.parsedBytes.toLocaleString()} UTF-8 bytes</p>
        <ul>{value.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <ul>{Object.entries(value.omissions).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul>
        {Object.keys(value.declarationOmissions).length > 0 && <p>Declaration work was also omitted; inspect Map coverage and gaps.</p>}
        <p>At most {value.limits.flows} outlines, {value.limits.flowSteps} steps each, {value.limits.documents} code files and {value.limits.textBytes / 1024} KiB code text, in addition to the declaration budget.</p>
        <p className="muted">{value.adapterVersion} · saved index {value.buildId.slice(0, 8)}</p>
      </details>
    </>}
  </div>;
}
