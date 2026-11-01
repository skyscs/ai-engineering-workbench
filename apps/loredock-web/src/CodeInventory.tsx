import { useEffect, useRef, useState } from 'react';
import type { AnalysisState, AnalysisSummary, AnalysisFileSummary, AnalysisPayload } from '../../loredock/src/code-analysis-types';
import { api } from './api';

type Page = { files: AnalysisFileSummary[]; offset: number; limit: number };
export function CodeInventory({ buildId, policyVersion, sourceSetVersion, staleIndex, openEvidence, clearEvidence }: {
  buildId: string; policyVersion: number; sourceSetVersion: number; staleIndex: boolean; openEvidence(id: string): void; clearEvidence(): void;
}) {
  const [state, setState] = useState<AnalysisState>(), [error, setError] = useState(''), [pollError, setPollError] = useState(''), [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false), [page, setPage] = useState<Page>(), [file, setFile] = useState<AnalysisPayload>();
  const [loading, setLoading] = useState(false);
  const alive = useRef(true), stateRequest = useRef(0), detailRequest = useRef(0), polling = useRef(false), mutating = useRef(false), inspected = useRef(false);
  const pendingStart = useRef<string | undefined>(undefined);
  const fileHeading = useRef<HTMLHeadingElement>(null);
  const run = state?.inventories.find(item => item.buildId === buildId);
  const runKey = run ? `${run.id}:${run.published}:${run.status === 'fenced'}:${run.currentParser}` : '';
  const currentRunKey = useRef(runKey); currentRunKey.current = runKey;
  const readable = Boolean(run && run.status !== 'fenced' && run.currentParser);
  useEffect(() => { if (file) fileHeading.current?.focus(); }, [file]);

  useEffect(() => {
    alive.current = true;
    async function poll() {
      if (polling.current || mutating.current) return; polling.current = true; const request = stateRequest.current;
      try {
        const response = await api<AnalysisState>('/code-analysis');
        if (alive.current && request === stateRequest.current) { setState(response); setPollError(''); }
      } catch (cause) { if (alive.current && request === stateRequest.current) setPollError((cause as Error).message); }
      finally { polling.current = false; }
    }
    void poll(); const timer = setInterval(() => { void poll(); }, 1000);
    return () => { alive.current = false; stateRequest.current++; detailRequest.current++; clearInterval(timer); };
  }, []);

  useEffect(() => {
    detailRequest.current++; setPage(undefined); setFile(undefined); setLoading(false);
    if (inspected.current) clearEvidence();
    if (expanded && readable) void loadPage(0);
  }, [runKey, clearEvidence]);

  async function loadPage(offset: number) {
    if (!run || !readable) return;
    const request = ++detailRequest.current, key = currentRunKey.current;
    inspected.current = true; clearEvidence(); setFile(undefined); setLoading(true); setError('');
    try {
      const response = await api<Page>(`/code-analysis/${encodeURIComponent(run.id)}/files?offset=${offset}`);
      if (alive.current && request === detailRequest.current && key === currentRunKey.current) { clearEvidence(); setPage(response); }
    } catch (cause) {
      if (alive.current && request === detailRequest.current && key === currentRunKey.current) { setPage(undefined); setError((cause as Error).message); }
    } finally { if (alive.current && request === detailRequest.current) setLoading(false); }
  }
  async function loadFile(fileId: string) {
    if (!run || !run.published || !readable) return;
    const request = ++detailRequest.current, key = currentRunKey.current;
    inspected.current = true; clearEvidence(); setFile(undefined); setLoading(true); setError('');
    try {
      const response = await api<AnalysisPayload>(`/code-analysis/${encodeURIComponent(run.id)}/files/${encodeURIComponent(fileId)}`);
      if (alive.current && request === detailRequest.current && key === currentRunKey.current) { clearEvidence(); setFile(response); }
    } catch (cause) { if (alive.current && request === detailRequest.current && key === currentRunKey.current) setError((cause as Error).message); }
    finally { if (alive.current && request === detailRequest.current) setLoading(false); }
  }
  async function act(action: 'start' | 'pause' | 'resume' | 'cancel') {
    if (busy || (!run && action !== 'start')) return;
    mutating.current = true; stateRequest.current++; detailRequest.current++; setBusy(true); setError(''); setFile(undefined); setPage(undefined); setLoading(false); clearEvidence();
    try {
      let response: AnalysisSummary;
      if (action === 'start') {
        pendingStart.current ??= crypto.randomUUID();
        response = await api<AnalysisSummary>('/code-analysis', 'POST', { requestId: pendingStart.current, buildId, policyVersion, sourceSetVersion });
      } else response = await api<AnalysisSummary>(`/code-analysis/${encodeURIComponent(run!.id)}/${action}`, 'POST');
      if (alive.current) {
        pendingStart.current = undefined;
        setState(previous => ({ inventories: [response, ...(previous?.inventories.filter(item => item.id !== response.id) ?? [])], pendingBuildId: previous?.pendingBuildId ?? null, automaticError: null }));
      }
    } catch (cause) { if (alive.current) setError((cause as Error).message); }
    finally { mutating.current = false; stateRequest.current++; if (alive.current) setBusy(false); }
  }
  const active = run?.status === 'running', resumable = run && ['paused', 'interrupted'].includes(run.status);
  const title = !run ? 'Not analyzed for this index yet.' : !run.currentParser ? 'The code analyzer changed.'
    : run.status === 'running' ? 'Examining code…' : run.status === 'paused' ? 'Code analysis paused.'
    : run.status === 'interrupted' ? 'Code analysis was interrupted.' : run.status === 'cancelled' ? 'Code analysis cancelled.'
    : run.status === 'failed' ? 'Code analysis failed.' : run.status === 'fenced' ? 'Sources or policy changed.'
    : run.status === 'partial' ? 'Code examined with coverage gaps.' : 'Code examination complete.';
  const automaticError = state?.automaticError?.buildId === buildId ? state.automaticError.message : undefined;
  const queued = state?.pendingBuildId === buildId;
  const omissions = run ? [['excluded', 'excluded'], ['failed', 'failed'], ['unattempted', 'unattempted'], ['omitted', 'fact outputs omitted'], ['pending', 'pending']]
    .filter(([status]) => (run.counts[status!] ?? 0) > 0).map(([status, label]) => `${run.counts[status!]} ${label}`).join(' · ') : '';
  const needsStart = !run || !run.currentParser || ['failed', 'cancelled', 'fenced'].includes(run.status);
  return <section className="code-inventory" aria-labelledby="code-coverage-heading">
    <h3 id="code-coverage-heading">Code coverage</h3>
    <p className="muted">Code is checked locally after each new index.</p>
    {!state ? <p role="status">Reading code coverage…</p> : <>
      <p role="status"><strong>{queued ? 'Code analysis is queued after the current inventory.' : title}</strong>
        {run && run.status !== 'fenced' && <span className="code-coverage-counts">{run.examined} of {run.candidates} code files examined
          {' · '}{run.filesWithGaps} files with syntax gaps ({run.gaps} messages)</span>}</p>
      {omissions && <p className="muted">{omissions}</p>}
      {run?.status === 'failed' && run.reason && <p className="error">{run.reason}</p>}
      {staleIndex && <p className="notice">Update knowledge to analyze the current repository set.</p>}
      {automaticError && <p className="error" role="alert">Automatic code analysis could not start: {automaticError}</p>}
      <div className="actions">
        {active && <button disabled={busy} onClick={() => void act('pause')}>Pause code analysis</button>}
        {resumable && run.currentParser && <button disabled={busy || staleIndex} onClick={() => void act('resume')}>Resume code analysis</button>}
        {(active || resumable) && <button className="quiet" disabled={busy} onClick={() => void act('cancel')}>Cancel code analysis</button>}
        {!active && !queued && needsStart && !staleIndex && <button disabled={busy} onClick={() => void act('start')}>{run ? 'Analyze code again' : 'Analyze code'}</button>}
      </div>
      <p className="muted">Code syntax alone does not establish runtime behavior.</p>
      <details className="code-inventory-details" open={expanded} onToggle={event => {
        const open = event.currentTarget.open; setExpanded(open);
        if (open && !loading) void loadPage(page?.offset ?? 0);
        if (!open) { detailRequest.current++; setFile(undefined); setLoading(false); clearEvidence(); }
      }}>
        <summary>Code files and limits</summary>
        {run && <p>{run.counts.parsed ?? 0} files have retained facts. Files with syntax gaps are still marked as examined.</p>}
        {run && !active && !queued && !needsStart && <button disabled={busy || staleIndex} onClick={() => void act('start')}>Analyze code again</button>}
        {run && <p className="muted">Up to {run.limits.documents.toLocaleString()} files, {run.limits.fileBytes / 1024} KiB and {run.limits.fileSpans} original spans per file.
          {' '}At most {run.limits.payloadBytes / 1024 / 1024} MiB of fact payloads per inventory; two inventories are retained.</p>}
        {!readable ? <p>Analyze this index to inspect its code files.</p> : <>
          {!page && !loading && <button disabled={busy} onClick={() => void loadPage(0)}>Show code files</button>}
          {loading && <p role="status">Reading code details…</p>}
          {page && <>
            <p>Showing {page.files.length ? page.offset + 1 : 0}–{page.offset + page.files.length} of {run!.candidates} code files.</p>
            <ul className="code-files" data-code-offset={page.offset}>{page.files.map(item => <li key={item.fileId} data-file-id={item.fileId}><strong>{item.sourceName}</strong><code>{item.path}</code>
              <p>{item.status === 'parsed' ? 'Facts retained' : item.status}{item.reason ? ` · ${item.reason}` : ''}{item.gapCount ? ` · ${item.gapCount} syntax gaps` : ''}</p>
              {item.status === 'parsed' && <button className="quiet" disabled={busy || loading || !run?.published} onClick={() => void loadFile(item.fileId)}>Inspect file facts</button>}
            </li>)}</ul>
            <nav className="code-pages" aria-label="Code file pages">
              <button disabled={busy || loading || page.offset === 0} onClick={() => void loadPage(page.offset - page.limit)}>Previous code files</button>
              <button disabled={busy || loading || page.offset + page.limit >= run!.candidates} onClick={() => void loadPage(page.offset + page.limit)}>Next code files</button>
            </nav>
            {!run?.published && <p>File facts become readable when this inventory finishes.</p>}
          </>}
          {file && <section className="code-file-facts" aria-label="Selected file facts">
            <h4 ref={fileHeading} tabIndex={-1}>{file.sourceName} / {file.path}</h4>
            <p>{file.facts.symbols.length} supported symbols · {file.facts.operations.length} operations · {file.facts.calls.length} static calls</p>
            {!file.facts.symbols.length && <p>No supported symbols were extracted. This does not mean the file has no behavior.</p>}
            <ul>{file.facts.symbols.map((symbol, index) => <li key={symbol.key}><code>{symbol.qualifiedName}</code>
              {' · '}lines {file.ranges.symbols[index]?.startLine}–{file.ranges.symbols[index]?.endLine}</li>)}</ul>
            <ul>{file.facts.operations.map((operation, index) => <li key={index}>{operation.kind}: {Object.values(operation.properties).join(' · ')}</li>)}</ul>
            {file.facts.gaps.length > 0 && <div className="notice"><strong>Unsupported syntax</strong><ul>{file.facts.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></div>}
            <p>Read the original before interpreting these syntax facts.</p>
            <div className="actions">{file.evidence.map(ref => <button key={ref.id} onClick={() => openEvidence(ref.id)}>Original lines {ref.startLine}–{ref.endLine}</button>)}</div>
          </section>}
        </>}
      </details>
    </>}
    {(error || pollError) && <p className="error" role="alert">{error || pollError}</p>}
  </section>;
}
