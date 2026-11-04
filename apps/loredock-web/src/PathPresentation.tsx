import type { CodePathGraphV2, CodePathsAvailableV2 } from '../../loredock/src/code-paths-v2-types';
import type { MapEvidence } from '../../loredock/src/system-map-types';

export function PathCitations({ ids, evidence, openOriginal }: { ids: string[]; evidence: Record<string, MapEvidence>; openOriginal(id: string): void }) {
  return <div className="citations">{ids.map(id => { const ref = evidence[id]; return ref && <button key={id} className="quiet" onClick={() => openOriginal(id)}>
    Original: {ref.sourceName} / {ref.path}:{ref.startLine}–{ref.endLine}
  </button>; })}</div>;
}

export function PathFlows({ graph, openOriginal }: { graph: CodePathGraphV2; openOriginal(id: string): void }) {
  return <>{graph.flows.map(flow => <article className="connected-flow" key={flow.id}>
    <h4>{flow.title}</h4>
    <ol>{flow.nodeIds.map((id, index) => { const node = graph.nodes.find(item => item.id === id)!;
      const edge = index > 0 ? graph.edges.find(item => item.id === flow.edgeIds[index - 1]) : undefined;
      return <li key={id}>
        {edge && <div className="connected-edge"><strong>{edge.status === 'candidate' ? 'Static connection candidate' : 'Static source connection'}</strong>
          <p>{edge.reason}</p>{edge.gaps.length > 0 && <ul>{edge.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>}
          {edge.topicCheck && <p className="topic-witness">Matching topic literal: <code>{edge.topicCheck.value}</code></p>}
          <PathCitations ids={edge.evidenceIds} evidence={graph.evidence} openOriginal={openOriginal} /></div>}
        <strong>{node.label}</strong><p>{node.sourceName} / <code>{node.path}</code>:{node.startLine} · {node.kind}</p>
        <PathCitations ids={node.evidenceIds} evidence={graph.evidence} openOriginal={openOriginal} />
      </li>;
    })}</ol>
    {flow.gaps.length > 0 && <details><summary>Path limitations</summary><ul>{flow.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></details>}
  </article>)}</>;
}

export function PathCoverage({ value, sourceNames }: { value: CodePathsAvailableV2; sourceNames: Record<string, string> }) {
  return <details className="connected-gaps"><summary>Path coverage and omissions</summary>
    <p>{value.coverage.incompleteBindings} incomplete bindings · {value.roots.unavailableEntries} entry points unavailable on this page</p>
    <dl>{Object.entries(value.coverage.inventoryCounts).map(([reason, count]) => <div key={reason}><dt>Code files: {reason}</dt><dd>{count}</dd></div>)}</dl>
    {value.coverage.sources.map(source => <p key={source.sourceId}>
      {sourceNames[source.sourceId] ?? 'Indexed source'}: {source.knownPaths} saved paths · {source.filesWithGaps} code files with syntax gaps · {source.omittedPaths} omitted paths
      {' · '}{source.opaquePaths} opaque paths · {source.treeVerified ? 'saved tree verified' : 'saved tree incomplete'}
    </p>)}
    <ul>{value.graph?.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
    {([['Binding gaps', value.coverage.bindingReasons], ['Resolution omissions', value.coverage.omissions],
      ['Declaration omissions', value.coverage.declarationOmissions], ['Path omissions', value.graph?.omissions ?? {}]] as const).map(([label, counts]) =>
      <div key={label}><h4>{label}</h4>{Object.entries(counts).length ? <ul>{Object.entries(counts).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul> : <p>No counted omissions at this stage.</p>}</div>)}
    <p className="muted">Saved index {value.identity.buildId.slice(0, 8)} · inventory {value.identity.inventoryId.slice(0, 8)}. Counts cover supported syntax only.</p>
  </details>;
}
