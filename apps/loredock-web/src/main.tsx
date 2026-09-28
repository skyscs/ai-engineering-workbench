import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectState, SearchResult, Evidence } from '../../loredock/src/types';
import './style.css';

let session: Promise<string> | undefined;
async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  session ??= fetch('/api/session', { method: 'POST', headers: { 'x-loredock-client': 'web' } }).then(async response => {
    if (!response.ok) throw new Error('Cannot connect to LoreDock. Reload to retry.');
    return (await response.json() as { token: string }).token;
  });
  const token = await session;
  const response = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', 'x-loredock-csrf': token }, ...body === undefined ? {} : { body: JSON.stringify(body) } });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error((result as { error?: { message?: string } }).error?.message ?? 'The request failed.');
  return result as T;
}
function App() {
  const [state, setState] = useState<ProjectState>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [sourcePath, setSourcePath] = useState(''); const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(''); const [results, setResults] = useState<SearchResult>();
  const [evidence, setEvidence] = useState<Evidence>(); const [excludes, setExcludes] = useState<string | null>(null);
  const [removal, setRemoval] = useState<string>();
  const [gaps, setGaps] = useState<{ path: string; status: string; reason: string | null; error: string | null }[]>();
  const pendingStart = useRef<{ requestId: string; sourceSetVersion: number; policyVersion: number } | undefined>(undefined);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const boundary = useRef('');
  const refresh = useCallback(async () => { const next = await api<ProjectState>('/project'); setState(next); }, []);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try { const next = await api<ProjectState>('/project'); if (!cancelled) setState(next); }
      catch (cause) { if (!cancelled) setError((cause as Error).message); }
    };
    void poll(); const timer = setInterval(() => { void poll(); }, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const policyVersion = state?.policyVersion;
  const sourceSetVersion = state?.sourceSetVersion;
  const published = state?.publishedBuildId;
  useEffect(() => { setResults(undefined); setEvidence(undefined); setGaps(undefined); }, [policyVersion, sourceSetVersion, selected, published]);
  useEffect(() => {
    if (selected && state && !state.builds.some(build => build.id === selected && build.published && build.policyVersion === state.policyVersion)) setSelected('');
  }, [selected, state]);
  useEffect(() => { if (evidence) evidenceHeading.current?.focus(); }, [evidence]);
  async function act(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try { await fn(); await refresh(); } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  const latest = state?.builds[0];
  const unfinished = latest && ['preparing', 'running', 'pause_requested', 'paused', 'interrupted'].includes(latest.status);
  const activeSources = state?.sources.filter(source => source.status === 'active') ?? [];
  const searchBuild = selected || published || '';
  boundary.current = `${state?.policyVersion}:${state?.sourceSetVersion}:${searchBuild}`;
  const currentBuild = state?.builds.find(build => build.id === searchBuild);
  function submitSource(event: FormEvent) { event.preventDefault(); void act(async () => { await api('/sources', 'POST', { path: sourcePath }); setSourcePath(''); }); }
  function search(event: FormEvent) { event.preventDefault(); void act(async () => {
    const current = boundary.current; setEvidence(undefined);
    const response = await api<SearchResult>(`/search?q=${encodeURIComponent(query)}&buildId=${encodeURIComponent(searchBuild)}`);
    if (current === boundary.current) setResults(response);
  }); }

  return <main>
    <header><a className="brand" href="/">LoreDock<span>System sources</span></a><span className="local">Local catalog · No model calls</span></header>
    <section className="intro"><p className="eyebrow">KNOW YOUR SYSTEM</p><h1>Start with the sources.</h1><p>Add your repositories, index committed files, and explore the evidence in one place.</p></section>
    {error && <div className="error" role="alert">{error}</div>}
    {!state ? <p role="status">Connecting to the local catalog…</p> : <div className="layout">
      <aside className="panel">
        <h2>Repositories <span className="count">{activeSources.length} / {state.limits.sources}</span></h2>
        <p className="muted">Use absolute paths to local Git repositories. Your working files stay untouched.</p>
        <ul className="sources">{activeSources.map(source => <li key={source.id}>
          <strong>{source.name}</strong><code>{source.path}</code>
          {removal === source.id ? <div className="confirm"><p>Remove this source and purge its indexed text? Saved citations will become unavailable.</p>
            <button disabled={busy} onClick={() => void act(async () => { await api(`/sources/${source.id}/revoke`, 'POST'); setRemoval(undefined); })}>Confirm removal</button>
            <button className="quiet" onClick={() => setRemoval(undefined)}>Keep source</button></div>
            : <button className="quiet" disabled={busy} onClick={() => setRemoval(source.id)}>Remove source</button>}
        </li>)}</ul>
        {activeSources.length < state.limits.sources && <form onSubmit={submitSource}>
          <label htmlFor="repository-path">Repository path</label><input id="repository-path" placeholder="/home/you/projects/order-api" value={sourcePath} onChange={event => setSourcePath(event.target.value)} required />
          <button disabled={busy || !sourcePath.trim()} type="submit">Add repository</button>
        </form>}
        <details className="advanced"><summary>Source policy and limits</summary>
          <p>Committed UTF-8 text only. Symlinks, submodules, LFS pointers, binary files and common secret paths are excluded. This is not a secret scanner.</p>
          <p>Up to {state.limits.paths.toLocaleString()} paths, {state.limits.fileBytes / 1024 / 1024} MiB per file and {state.limits.totalBytes / 1024 / 1024} MiB total. A {state.limits.wallMs / 60000}-minute wall limit pauses indexing.</p>
          <label htmlFor="exclusions">Additional excluded paths</label><textarea id="exclusions" rows={4} placeholder={'private\nconfig/credentials.json'} value={excludes ?? state.policy.excludedPaths.join('\n')} onChange={event => setExcludes(event.target.value)} />
          <p>One relative file or directory prefix per line. Changing policy fences old indexes until you index again.</p>
          <button disabled={busy} onClick={() => void act(async () => { await api('/policy', 'PUT', { excludedPaths: (excludes ?? state.policy.excludedPaths.join('\n')).split('\n').map(line => line.trim()).filter(Boolean) }); pendingStart.current = undefined; setExcludes(null); setSelected(''); })}>Save policy</button>
        </details>
      </aside>
      <section className="workspace">
        <div className="panel">
          <div className="section-heading"><div><h2>Source index</h2><p className="muted">Each index keeps its own committed revisions.</p></div>
            <button className="primary" disabled={busy || !activeSources.length || Boolean(unfinished)} onClick={() => void act(async () => {
              pendingStart.current ??= { requestId: crypto.randomUUID(), sourceSetVersion: state.sourceSetVersion, policyVersion: state.policyVersion };
              await api('/builds', 'POST', pendingStart.current); pendingStart.current = undefined; setSelected('');
            })}>Index sources</button></div>
          {!latest ? <div className="empty"><strong>{activeSources.length ? 'Ready when you are.' : 'Add your first repository.'}</strong><p>The index will make committed text searchable and show what was excluded.</p></div> : <>
            <div role="status" className="progress"><strong>{latest.status === 'partial' ? 'Indexed with coverage gaps' : latest.status[0]!.toUpperCase() + latest.status.slice(1).replaceAll('_', ' ')}</strong>
              <span>{latest.coverage.indexed} indexed · {latest.coverage.excluded} excluded · {latest.coverage.failed} failed · {latest.coverage.pending} pending</span></div>
            {latest.reason && <p className="muted">{latest.reason}</p>}
            {unfinished && <div className="actions">
              {['preparing', 'running'].includes(latest.status) && <button disabled={busy} onClick={() => void act(async () => { await api(`/builds/${latest.id}/pause`, 'POST'); })}>Pause</button>}
              {['paused', 'interrupted'].includes(latest.status) && <button disabled={busy} onClick={() => void act(async () => { await api(`/builds/${latest.id}/resume`, 'POST'); })}>Resume</button>}
              <button disabled={busy} className="quiet" onClick={() => void act(async () => { await api(`/builds/${latest.id}/cancel`, 'POST'); })}>Cancel index</button>
            </div>}
            <details><summary>Coverage and revisions</summary><p>Deployment coherence: unknown. Matching source revisions do not prove these versions are deployed together.</p>
              {latest.sources.map(source => <div className="coverage" key={source.sourceId}><strong>{source.name}</strong> <span>{source.status}</span>
                <code>{source.revision ?? 'Revision unavailable'}</code>
                <p>{source.coverage.indexed} indexed · {source.coverage.excluded} excluded · {source.coverage.failed} failed · {source.omitted} omitted by path limit</p>
                {source.dirty && <p>Working files may differ. Local changes are excluded from this index.</p>}{source.error && <p className="error">{source.error}</p>}
                {Object.entries(source.coverage.reasons).map(([reason, count]) => <span className="tag" key={reason}>{reason}: {count}</span>)}
              </div>)}
              <button disabled={busy || latest.policyVersion !== state.policyVersion} onClick={() => void act(async () => { setGaps((await api<{ files: NonNullable<typeof gaps> }>(`/builds/${latest.id}/files`)).files); })}>Show excluded and failed files</button>
              {gaps && <div className="gaps"><p>Up to 100 file records are shown. Counts above cover the full inventory.</p>{gaps.map((file, index) => <p key={index}><code>{file.path}</code> — {file.reason}{file.error ? `: ${file.error}` : ''}</p>)}</div>}
            </details>
          </>}
        </div>
        <div className="panel">
          <h2>Explore the sources</h2><p className="muted">Search exact terms such as an endpoint, event, collection or class name.</p>
          {state.builds.filter(build => build.published && build.policyVersion === state.policyVersion).length > 0 && <label className="history">Index version<select aria-label="Index version" value={selected} onChange={event => setSelected(event.target.value)}>
            <option value="">Latest published index</option>{state.builds.filter(build => build.published && build.policyVersion === state.policyVersion).map(build => <option key={build.id} value={build.id}>{new Date(build.createdAt).toLocaleString()} · {build.status} · {build.id.slice(0, 8)}</option>)}
          </select></label>}
          {currentBuild && currentBuild.sourceSetVersion !== state.sourceSetVersion && <p className="notice">Sources changed since this index. Removed sources are fenced; index again to include the current source set.</p>}
          <form className="search" onSubmit={search}><label className="sr-only" htmlFor="source-query">Search sources</label><input id="source-query" placeholder="Try orders.placed.v2" value={query} onChange={event => setQuery(event.target.value)} required maxLength={500} /><button className="primary" disabled={busy || !searchBuild || !query.trim()}>Search</button></form>
          {!searchBuild && <p className="empty">Index your sources to start exploring.</p>}
          {results && <><p role="status">{results.hits.length ? `${results.hits.length} matching passages (up to 30 shown).` : 'No indexed matches. This does not prove the behavior is absent; check coverage and excluded sources.'}</p>
            {results.partial && <p className="muted">This index has coverage gaps.</p>}
            <ul className="results">{results.hits.map(hit => <li key={hit.id}><button className="result" disabled={busy} onClick={() => void act(async () => { const current = boundary.current; const response = await api<Evidence>(`/evidence/${hit.id}`); if (current === boundary.current) setEvidence(response); })}>
              <span className="result-meta">{hit.sourceName} · lines {hit.startLine}–{hit.endLine} · {hit.revision.slice(0, 8)}</span><strong>{hit.path}</strong><span className="snippet">{hit.snippet}</span></button></li>)}</ul></>}
        </div>
        {evidence && <section className="panel evidence"><h2 ref={evidenceHeading} tabIndex={-1}>Source evidence</h2><p><strong>{evidence.sourceName}</strong> / {evidence.path}</p><code>{evidence.revision}</code>
          <p className="muted">Lines {evidence.startLine}–{evidence.endLine}. Immutable committed snapshot; line display normalizes CRLF to LF.</p>
          <pre>{evidence.text.split('\n').map((line, index) => `${evidence.startLine + index}  ${line}`).join('\n')}</pre>
          <details><summary>Integrity and extracted metadata</summary><p>File SHA-256: <code>{evidence.contentHash}</code></p><p>Git blob: <code>{evidence.blobId}</code></p><pre>{JSON.stringify(evidence.metadata, null, 2)}</pre></details>
        </section>}
      </section>
    </div>}
    <footer>Source coverage first. AI answers and system relationships are planned for later iterations.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
