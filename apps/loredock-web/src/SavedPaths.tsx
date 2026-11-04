import { useEffect, useRef, useState } from 'react';
import type { PathHistoryResult } from '../../loredock/src/native-capture-api';
import { api } from './api';
import { PathCoverage, PathFlows } from './PathPresentation';

export function savedPathLink(search: string): string | null | undefined {
  const params = new URLSearchParams(search);
  if (!params.has('savedPath')) return undefined;
  const id = params.get('savedPath')!;
  return params.size === 1 && /^[a-f0-9]{64}$/.test(id) ? id : null;
}

export function SavedPaths({ receiptId, boundary, projectAvailable }: { receiptId: string | null; boundary: string; projectAvailable: boolean }) {
  const scope = boundary + ':' + projectAvailable;
  const current = useRef(scope); current.current = scope;
  const first = useRef(true), reopen = useRef<() => void>(() => {});
  const [reply, setReply] = useState<{ scope: string; value: PathHistoryResult }>();
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [originalId, setOriginalId] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null), originalHeading = useRef<HTMLHeadingElement>(null);
  const value = reply?.scope === scope ? reply.value : undefined;
  const original = value?.originals.find(row => row.id === originalId);
  useEffect(() => {
    let alive = true, active: AbortController | undefined, sequence = 0;
    setReply(undefined); setOriginalId(undefined); setLoading(false);
    async function read() {
      if (!receiptId || !projectAvailable || active) return;
      const request = ++sequence, controller = new AbortController(); active = controller;
      const valid = () => alive && current.current === scope && request === sequence;
      setReply(undefined); setOriginalId(undefined); setLoading(true); setError('');
      try {
        const next = await api<PathHistoryResult>('/path-captures/' + receiptId, 'GET', undefined, controller.signal);
        if (next.status !== 'recorded' || next.receiptId !== receiptId || next.currentApplicability !== 'not-checked'
          || next.projection?.schemaVersion !== 'loredock-code-paths/2' || next.projection.graph?.schemaVersion !== 'loredock-connected-display/2')
          throw new Error('The saved-path response is out of date. Reload LoreDock.');
        if (valid()) setReply({ scope, value: next });
      } catch (cause) { if (valid()) setError((cause as Error).message); }
      finally { if (valid()) setLoading(false); active = undefined; }
    }
    reopen.current = () => { void read(); };
    if (first.current) { first.current = false; void read(); }
    else setError('Project access or the published index changed. Reopen saved paths to check this record again.');
    return () => { alive = false; sequence++; active?.abort(); reopen.current = () => {}; };
  }, [receiptId, scope, projectAvailable]);
  useEffect(() => { if (value) heading.current?.focus(); }, [value]);
  useEffect(() => { if (original) originalHeading.current?.focus(); }, [original]);
  return <section className="panel saved-path-view" aria-busy={loading} data-receipt-id={value?.receiptId}>
    <p><a href="/">Return to current browsing</a></p>
    <h1 id="saved-path-heading" ref={heading} tabIndex={-1}>Saved paths</h1>
    <p className="notice">Recorded source connections. Applicability to current code has not been checked.
      Runtime behavior and deployment coherence are unknown.</p>
    {!receiptId ? <p className="error" role="alert">This saved-path link is invalid. Open a link created by Save paths.</p> : <>
      {!projectAvailable && <p className="error" role="alert">Project access could not be refreshed. Saved content is hidden until access can be checked again.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={loading || !projectAvailable} onClick={() => reopen.current()}>Reopen saved paths</button>
      {loading && <p role="status">Opening saved paths…</p>}
      {value && <>
        {value.stale && <p className="notice">The published index or source set has changed since this record. These are the recorded paths.</p>}
        <p>{value.projection.graph.flows.length} recorded paths · {value.originals.length} original passages · {value.dependencies.length} source dependencies</p>
        <PathFlows graph={value.projection.graph} openOriginal={setOriginalId} />
        {original && <section className="saved-evidence">
          <h2 ref={originalHeading} tabIndex={-1}>Saved original</h2>
          <p><strong>{original.sourceName}</strong> / {original.path}</p><code>{original.revision}</code>
          <p className="muted">Lines {original.startLine}–{original.endLine}. Exact saved passage from the recorded revision.</p>
          <pre>{original.text.split('\n').map((line, index) => `${original.startLine + index}  ${line}`).join('\n')}</pre>
        </section>}
        <details className="saved-source-scope"><summary>Recorded sources ({value.dependencies.length})</summary>
          <p>Every dependency was authorized when this record was opened, including sources without displayed nodes.</p>
          {value.dependencies.map(source => <div key={source.sourceId}><strong>{source.name}</strong>
            <p><code>{source.revision ?? 'Revision unavailable'}</code></p><p>{source.status} · {source.omitted} omitted paths</p></div>)}
        </details>
        <PathCoverage value={value.projection} sourceNames={Object.fromEntries(value.dependencies.map(source => [source.sourceId, source.name]))} />
      </>}
    </>}
  </section>;
}
