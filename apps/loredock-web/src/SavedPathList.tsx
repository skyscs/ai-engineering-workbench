import { useEffect, useRef, useState } from 'react';
import type { PathCaptureListResult } from '../../loredock/src/native-capture-api';
import type { CaptureListRequest } from '../../loredock/src/native-capture-list';
import { api, ApiError } from './api';

type Props = { boundary: string; projectAvailable: boolean };
export function SavedPathList(props: Props) {
  const [expanded, setExpanded] = useState(false);
  return <details className="panel saved-path-list" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Browse saved paths</summary>
    {expanded && <SavedPage {...props} />}
  </details>;
}

function SavedPage({ boundary, projectAvailable }: Props) {
  const scope = boundary + ':' + projectAvailable, current = useRef(scope); current.current = scope;
  const first = useRef(true), read = useRef<(selection: CaptureListRequest) => void>(() => {});
  const [reply, setReply] = useState<{ scope: string; value: PathCaptureListResult }>();
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [smaller, setSmaller] = useState<CaptureListRequest>();
  const heading = useRef<HTMLHeadingElement>(null);
  const value = reply?.scope === scope ? reply.value : undefined;
  useEffect(() => {
    let alive = true, sequence = 0, active: AbortController | undefined;
    setReply(undefined); setSmaller(undefined); setLoading(false);
    async function load(selection: CaptureListRequest) {
      if (!projectAvailable || active) return;
      const request = ++sequence, controller = new AbortController(); active = controller;
      const valid = () => alive && current.current === scope && sequence === request;
      setReply(undefined); setSmaller(undefined); setError(''); setLoading(true);
      const params = new URLSearchParams();
      for (const [key, entry] of Object.entries(selection)) params.set(key, String(entry));
      try {
        const next = await api<PathCaptureListResult>('/path-captures' + (params.size ? '?' + params.toString() : ''), 'GET', undefined, controller.signal);
        if (next.schemaVersion !== 'loredock-path-captures/1' || next.pageSize !== (selection.pageSize ?? 4)
          || next.offset !== (selection.offset ?? 0) || !/^[a-f0-9]{64}$/.test(next.generationId)
          || (selection.generationId !== undefined && selection.generationId !== next.generationId)
          || !Array.isArray(next.items) || next.items.length > next.pageSize
          || next.items.some(item => !/^[a-f0-9]{64}$/.test(item.receiptId) || item.currentApplicability !== 'not-checked'))
          throw new Error('The saved-path list response is out of date. Reload LoreDock.');
        if (valid()) setReply({ scope, value: next });
      } catch (cause) {
        if (valid()) {
          setError((cause as Error).message);
          if ((selection.pageSize ?? 4) === 4 && cause instanceof ApiError && cause.status === 409
            && ['CAPTURE_WORK_LIMIT', 'CAPTURE_TIME_LIMIT', 'CAPTURE_LIST_BYTES_LIMIT'].includes(cause.code ?? ''))
            setSmaller({ ...selection, pageSize: 1 });
        }
      } finally { if (valid()) setLoading(false); active = undefined; }
    }
    read.current = selection => { void load(selection); };
    if (first.current) { first.current = false; void load({}); }
    else setError('Project access or the published index changed. Refresh saved paths to check access again.');
    return () => { alive = false; sequence++; active?.abort(); read.current = () => {}; };
  }, [scope, projectAvailable]);
  useEffect(() => { if (value) heading.current?.focus(); }, [value]);
  const page = (offset: number) => { if (value) read.current({ pageSize: value.pageSize, generationId: value.generationId, offset }); };
  return <div className="saved-path-page" aria-busy={loading} data-offset={value?.offset} data-page-size={value?.pageSize}>
    <h2 ref={heading} tabIndex={-1}>Saved paths in this catalog</h2>
    <p>Open recorded connections without keeping a bookmark. Applicability to current code has not been checked.</p>
    <p className="muted">Stable record order, not newest first. Refresh to include new saves.</p>
    {!projectAvailable && <p className="error" role="alert">Project access could not be refreshed. Saved summaries are hidden until access can be checked again.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
      <button disabled={loading || !projectAvailable} onClick={() => read.current({})}>Refresh saved paths</button>
      {smaller && <button disabled={loading || !projectAvailable} onClick={() => read.current(smaller)}>Show one saved path</button>}
    </div>
    {loading && <p role="status">Checking saved paths…</p>}
    {value && <>
      <p role="status">{value.totalStored === 0 ? 'No saved paths yet. Use Save paths while browsing connected paths.'
        : `Records ${value.offset + 1}–${value.offset + value.scanned} of ${value.totalStored} in this list. ${value.items.length} available on this page.`}</p>
      {value.totalStored === 64 && <p className="notice">Saved-path storage is full. Existing records can still be opened. Deletion is not available yet.</p>}
      {value.unavailableCount > 0 && <p className="notice">{value.unavailableCount} retained {value.unavailableCount === 1 ? 'record is' : 'records are'} unavailable under the current policy. Their contents are hidden.</p>}
      <ul className="saved-path-items">{value.items.map(item => <li key={item.receiptId} data-receipt-id={item.receiptId}>
        <h3><a href={'/?savedPath=' + item.receiptId}>{item.titles.join(' · ') || 'Recorded paths'}</a></h3>
        <p>{item.rootId === null ? 'Default paths' : 'Selected entry point'} · {item.originalCount} original passages · {item.dependencies.length} source dependencies</p>
        {item.stale && <p className="notice">The published index or source set has changed since this record.</p>}
        <details><summary>Recorded sources ({item.dependencies.length})</summary>
          {item.dependencies.map(source => <p key={source.sourceId}><strong>{source.name}</strong><br /><code>{source.revision ?? 'Revision unavailable'}</code></p>)}
        </details>
      </li>)}</ul>
      <nav className="actions" aria-label="Saved path pages">
        <button disabled={value.previousOffset === null} onClick={() => page(value.previousOffset!)}>Previous saved paths</button>
        <button disabled={value.nextOffset === null} onClick={() => page(value.nextOffset!)}>Next saved paths</button>
      </nav>
    </>}
  </div>;
}
