import { useEffect, useRef, useState } from 'react';
import type { AnalysisState, AnalysisSummary } from '../../loredock/src/code-analysis-types';
import type { CodePathsAvailable, CodePathsResponse } from '../../loredock/src/code-paths-types';
import type { MapEvidence } from '../../loredock/src/system-map-types';
import { api } from './api';

type Props = { buildId: string; staleIndex: boolean; sourceNames: Record<string, string>; openEvidence(id: string): void; clearEvidence(): void };
type Selection = { inventoryId?: string; generationId?: string; rootId?: string; offset?: number };
type Read = (selection: Selection) => void;

export function ConnectedPaths(props: Props) {
  const [expanded, setExpanded] = useState(false);
  return <details className="connected-paths" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Browse connected paths</summary>
    {expanded && <PathBrowser {...props} />}
  </details>;
}

function PathBrowser({ buildId, staleIndex, sourceNames, openEvidence, clearEvidence }: Props) {
  const [result, setResult] = useState<CodePathsResponse>();
  const [error, setError] = useState(''), [pollError, setPollError] = useState('');
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<AnalysisSummary>();
  const [attempt, setAttempt] = useState<AnalysisSummary>();
  const read = useRef<Read>(() => {}), retry = useRef(() => {});
  const ownedEvidence = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const focusAfterRead = useRef(false);
  useEffect(() => {
    let alive = true, sequence = 0, inventoryId: string | undefined | null = null;
    let active: AbortController | undefined, polling = false, pending: Selection | undefined;
    const pollController = new AbortController();
    let last: Selection = {};
    function clearOriginal() { if (ownedEvidence.current) { clearEvidence(); ownedEvidence.current = false; } }
    async function drain() {
      if (active || !pending || !alive) return;
      const selection = pending; pending = undefined;
      const request = sequence, controller = new AbortController(); active = controller;
      const params = new URLSearchParams({ buildId });
      for (const [key, value] of Object.entries(selection)) params.set(key, String(value));
      const valid = () => alive && request === sequence;
      try {
        const response = await api<CodePathsResponse>(`/code-paths${selection.offset === undefined ? '' : '/roots'}?${params}`, 'GET', undefined, controller.signal);
        if (valid()) {
          // A publication can race the unpinned read. Wait for inventory polling to select it.
          if (response.status === 'available' && response.identity.inventoryId !== inventoryId) {
            setError('Code coverage changed while reading paths. Reload default paths after coverage refreshes.');
          } else { setResult(response); setError(''); }
        }
      } catch (cause) { if (valid()) setError((cause as Error).message); }
      finally {
        if (valid()) setLoading(false);
        active = undefined;
        if (alive) void drain();
      }
    }
    function request(selection: Selection) {
      sequence++; last = selection; pending = selection; active?.abort(); clearOriginal();
      setResult(undefined); setError(''); setLoading(true); void drain();
    }
    read.current = request; retry.current = () => request(last);
    async function poll() {
      if (polling || !alive) return;
      polling = true;
      try {
        const state = await api<AnalysisState>('/code-analysis', 'GET', undefined, pollController.signal);
        if (!alive) return;
        const runs = state.inventories.filter(run => run.buildId === buildId);
        const published = runs.find(run => run.published && run.currentParser && run.status !== 'fenced');
        setInventory(published); setAttempt(runs[0]); setPollError('');
        if (inventoryId !== published?.id) { inventoryId = published?.id; request({}); }
      } catch (cause) { if (alive) { setPollError((cause as Error).message); setLoading(false); } }
      finally { polling = false; }
    }
    void poll(); const timer = setInterval(() => { void poll(); }, 1000);
    return () => { alive = false; sequence++; pending = undefined; active?.abort(); pollController.abort(); clearInterval(timer); clearOriginal(); };
  }, [buildId, clearEvidence]);
  useEffect(() => {
    if (!loading && focusAfterRead.current) { heading.current?.focus(); focusAfterRead.current = false; }
  }, [loading]);
  const available = result?.status === 'available' ? result : undefined;
  function navigate(selection: Selection) { focusAfterRead.current = true; read.current(selection); }
  function original(id: string) { ownedEvidence.current = true; openEvidence(id); }
  function citations(ids: string[], evidence: Record<string, MapEvidence>) {
    return <div className="citations">{ids.map(id => { const ref = evidence[id]; return ref && <button key={id} className="quiet" onClick={() => original(id)}>
      Original: {ref.sourceName} / {ref.path}:{ref.startLine}–{ref.endLine}
    </button>; })}</div>;
  }
  const pin = (value: CodePathsAvailable): Selection => ({ inventoryId: value.identity.inventoryId, generationId: value.generationId });
  return <section className="connected-path-browser" aria-labelledby="connected-path-heading" aria-busy={loading}
    data-inventory-id={available?.identity.inventoryId} data-generation-id={available?.generationId} data-root-id={available?.selection.rootId ?? ''}>
    <h3 id="connected-path-heading" ref={heading} tabIndex={-1}>Partial source paths</h3>
    <p className="notice">Static source connections only. Runtime behavior and deployment coherence are unknown.
      Missing paths do not establish absence of behavior.</p>
    <p className="muted">This local preview makes no model calls and is not answer context. Reviewable links remain in Static flow outlines.</p>
    {staleIndex && <p className="notice">Paths use an older saved index.</p>}
    {attempt && !attempt.published && <p className="notice">Code analysis is {attempt.status}.
      {inventory ? ' Paths use an earlier completed inventory.' : ' Waiting for the first compatible completed inventory; analysis is controlled in Code coverage.'}</p>}
    {loading && <p role="status">Reading connected paths…</p>}
    {pollError && <p className="error" role="alert">Code coverage could not refresh: {pollError}</p>}
    {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => { focusAfterRead.current = true; retry.current(); }}>Retry path request</button>
      <button className="quiet" onClick={() => navigate({})}>Reload default paths</button></div>}
    {result?.status === 'unavailable' && <p role="status">{result.reason.message}</p>}
    {(!available || available.coverage.incompleteBindings > 0) && <p><a href="#code-coverage-heading" onClick={() => document.getElementById('code-coverage-heading')?.focus()}>Inspect Code coverage</a></p>}
    {available && <>
      <p>{available.coverage.scannedFiles} of {available.coverage.retainedFiles} retained code files scanned · {available.roots.total} supported entry points
        {' · '}{available.roots.outsidePage} outside this page</p>
      <p className="muted">Entry points are ordered by source syntax, not importance or incident relevance.</p>
      <ul className="connected-roots" data-offset={available.roots.offset}>{available.roots.items.map(root => <li key={root.id}>
        {root.status === 'unavailable' ? <p>Entry point unavailable: {root.reason}</p> : <>
          <button className="quiet" onClick={() => navigate({ ...pin(available), rootId: root.id })} aria-pressed={available.selection.rootId === root.id}>
            <strong>{root.label}</strong><span>{root.sourceName} / {root.path}:{root.startLine} · {root.role}</span>
          </button>{citations(root.evidenceIds, available.roots.evidence)}
        </>}
      </li>)}</ul>
      {!available.roots.total && <p>No supported entry points in this inventory. Unsupported code may still contain entry points.</p>}
      <nav className="actions" aria-label="Connected entry-point pages">
        <button disabled={available.roots.previous === null} onClick={() => navigate({ ...pin(available), offset: available.roots.previous! })}>Previous entry points</button>
        <button disabled={available.roots.next === null} onClick={() => navigate({ ...pin(available), offset: available.roots.next! })}>Next entry points</button>
        <button className="quiet" onClick={() => navigate(pin(available))}>Show default paths</button>
      </nav>
      {available.graph ? <>
        <p>{available.graph.flows.length} paths shown · {Math.max(0, available.roots.total - available.graph.coverage.selectedRoots.length)} entry points outside the selected paths</p>
        {!available.graph.flows.length && <p>No complete supported path fits this selection. Inspect the coverage and omissions below.</p>}
        {available.graph.flows.map(flow => <article className="connected-flow" key={flow.id}>
          <h4>{flow.title}</h4>
          <ol>{flow.nodeIds.map((id, index) => { const node = available.graph!.nodes.find(item => item.id === id)!;
            const edge = index > 0 ? available.graph!.edges.find(item => item.id === flow.edgeIds[index - 1]) : undefined;
            return <li key={id}>
              {edge && <div className="connected-edge"><strong>{edge.status === 'candidate' ? 'Static connection candidate' : 'Static source connection'}</strong>
                <p>{edge.reason}</p>{edge.gaps.length > 0 && <ul>{edge.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>}
                {citations(edge.evidenceIds, available.graph!.evidence)}</div>}
              <strong>{node.label}</strong><p>{node.sourceName} / <code>{node.path}</code>:{node.startLine} · {node.kind}</p>
              {citations(node.evidenceIds, available.graph!.evidence)}
            </li>;
          })}</ol>
          {flow.gaps.length > 0 && <details><summary>Path limitations</summary><ul>{flow.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></details>}
        </article>)}
      </> : <p>Choose an entry point to inspect its path. Changing pages clears the previous path.</p>}
      <details className="connected-gaps"><summary>Path coverage and omissions</summary>
        <p>{available.coverage.incompleteBindings} incomplete bindings · {available.roots.unavailableEntries} entry points unavailable on this page</p>
        <dl>{Object.entries(available.coverage.inventoryCounts).map(([reason, count]) => <div key={reason}><dt>Code files: {reason}</dt><dd>{count}</dd></div>)}</dl>
        {available.coverage.sources.map(source => <p key={source.sourceId}>
          {sourceNames[source.sourceId] ?? 'Indexed source'}: {source.knownPaths} saved paths · {source.filesWithGaps} code files with syntax gaps · {source.omittedPaths} omitted paths
          {' · '}{source.opaquePaths} opaque paths · {source.treeVerified ? 'saved tree verified' : 'saved tree incomplete'}
        </p>)}
        <ul>{available.graph?.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
        {([['Binding gaps', available.coverage.bindingReasons], ['Resolution omissions', available.coverage.omissions],
          ['Declaration omissions', available.coverage.declarationOmissions], ['Path omissions', available.graph?.omissions ?? {}]] as const).map(([label, counts]) =>
          <div key={label}><h4>{label}</h4>{Object.entries(counts).length ? <ul>{Object.entries(counts).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul> : <p>No counted omissions at this stage.</p>}</div>)}
        <p className="muted">Saved index {buildId.slice(0, 8)} · inventory {available.identity.inventoryId.slice(0, 8)}. Counts cover supported syntax only.</p>
      </details>
    </>}
  </section>;
}
