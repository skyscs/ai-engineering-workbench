import { useEffect, useId, useRef, useState } from 'react';
import type { ReapplicationInput, ReconciliationPreview, ReconciliationStatus } from '../../loredock/src/reconciliation-types';
import type { CorrectionHistory, CorrectionSummary } from '../../loredock/src/correction-types';
import { api } from './api';

const labels: Record<ReconciliationStatus, string> = { 'support-unchanged': 'Supporting evidence unchanged', 'support-changed': 'Supporting evidence changed',
  missing: 'Link not found in this projection', ambiguous: 'Several possible links', unsupported: 'Comparison unavailable', 'already-reviewed': 'Already reviewed in this index' };

export function EarlierCorrections({ buildId, boundary, revision, changed, openEvidence }: {
  buildId: string; boundary: string; revision: number; changed(): void; openEvidence(id: string): void;
}) {
  const sourceKey = `${boundary}:${buildId}`, field = useId();
  const [selection, setSelection] = useState<{ key: string; id: string }>(), [reload, setReload] = useState(0);
  const from = selection?.key === sourceKey ? selection.id : '';
  const key = `${sourceKey}:${revision}:${from}:${reload}`, currentKey = useRef(key); currentKey.current = key;
  const [result, setResult] = useState<{ key: string; value: ReconciliationPreview }>(), [error, setError] = useState<{ key: string; text: string }>();
  const [busy, setBusy] = useState<string>();
  const pending = useRef<{ key: string; sourceId: string; input: ReapplicationInput } | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let stopped = false;
    void api<ReconciliationPreview>(`/correction-reconciliation?buildId=${encodeURIComponent(buildId)}${from ? `&fromBuildId=${encodeURIComponent(from)}` : ''}`).then(value => {
      if (!stopped) { setResult({ key, value }); setError(undefined); }
    }).catch(cause => { if (!stopped) setError({ key, text: (cause as Error).message }); });
    return () => { stopped = true; };
  }, [buildId, key, from]);
  const preview = result?.key === key && result.value.revision >= revision ? result.value : undefined;
  function refresh() { pending.current = undefined; setReload(value => value + 1); changed(); }
  async function apply(sourceId: string, targetId: string) {
    if (!preview?.editable || busy === key) return;
    if (pending.current?.key !== key || pending.current.sourceId !== sourceId) pending.current = { key, sourceId,
      input: { requestId: crypto.randomUUID(), buildId, sourceCorrectionId: sourceId, targetId, previewHash: preview.previewHash, expectedRevision: preview.revision } };
    setBusy(key); setError(undefined);
    try {
      await api<CorrectionSummary>('/corrections/reapply', 'POST', pending.current.input);
      if (alive.current && currentKey.current === key) { pending.current = undefined; setReload(value => value + 1); changed(); }
    } catch (cause) { if (alive.current && currentKey.current === key) setError({ key, text: (cause as Error).message }); }
    finally { if (alive.current && currentKey.current === key) setBusy(undefined); }
  }
  function openCurrent(id: string) {
    const element = document.querySelector<HTMLElement>(`.link-correction[data-target-id="${id}"]`);
    if (!element) { setError({ key, text: 'This link is outside the displayed flow outlines. Review its current source evidence before adding a new note.' }); return; }
    let parent = element.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    element.scrollIntoView({ block: 'center' }); element.querySelector<HTMLButtonElement>('button')?.focus();
  }
  if (preview && !preview.ancestors.length && preview.editable && preview.gaps.length === 2) return null;
  return <section className="earlier-corrections" aria-label="Earlier engineer corrections" data-build-id={preview?.buildId} data-from-build-id={preview?.fromBuildId}>
    <h3>Earlier engineer corrections</h3>
    {error?.key === key && <p className="error" role="alert">{error.text}</p>}
    {!preview ? error?.key !== key && <p role="status">Comparing earlier reviews…</p> : <>
      <p className="muted">Earlier notes stay in their original index. Review each proposal before applying it here.</p>
      {preview.stale && <p className="notice">You are reviewing a historical index or source registry. Applying a note affects only this selected index.</p>}
      {!preview.editable && <p className="notice">Index the remaining sources to review earlier corrections.</p>}
      <p role="status">{preview.entries.filter(entry => entry.status === 'support-unchanged').length} ready for your review · {preview.activeCorrections} earlier active correction{preview.activeCorrections === 1 ? '' : 's'}</p>
      {preview.ancestors.length > 1 && <details className="earlier-index-selection"><summary>Choose an older review index</summary>
        <label htmlFor={`${field}-source`}>Earlier index</label><select id={`${field}-source`} value={preview.fromBuildId ?? ''} disabled={busy === key}
          onChange={event => { pending.current = undefined; setSelection({ key: sourceKey, id: event.target.value }); }}>
          {preview.ancestors.map((item, index) => <option value={item.id} key={item.id}>{index === 0 ? 'Previous index' : 'Older index'} · {item.id.slice(0, 8)} · {item.activeCorrections} active correction{item.activeCorrections === 1 ? '' : 's'}</option>)}
        </select><p>Older notes are shown only when you choose their index; a nearer withdrawal is not automatically replaced.</p>
      </details>}
      {!preview.entries.length && preview.fromBuildId && <p>No active earlier corrections in the chosen index. Choose an older index if you skipped a review.</p>}
      {preview.entries.map(entry => <details className="earlier-correction" key={`${preview.previewHash}:${entry.source.id}`} data-status={entry.status}>
        <summary>{labels[entry.status]} · {entry.original.from.label} → {entry.original.to.label}</summary>
        <p>{entry.reason}</p><blockquote className="earlier-statement">{entry.source.statement}</blockquote>
        <p>Earlier engineer scope: {entry.source.environment ?? 'not specified'} · {entry.source.action} · unverified</p>
        <p className="notice">Review the wider current scope too. Identical supporting files do not establish that this note is still correct.</p>
        <div className="review-comparison">{[entry.original, entry.current].map((claim, index) => <div key={index}>
          <strong>{index === 0 ? 'Earlier relationship' : 'Selected index relationship'}</strong>
          {claim ? <><p>{claim.from.sourceName} / {claim.from.label} → {claim.to.sourceName} / {claim.to.label}</p>
            <p>{claim.reason}</p><p className="muted">{claim.status} · scope {claim.environment ?? 'unspecified'}</p>
            <div className="correction-evidence">{claim.evidenceIds.map(id => {
              const span = preview.evidence[id]; return <button className="quiet" key={id} onClick={() => openEvidence(id)}>
                {span ? `${span.sourceName} / ${span.path}:${span.startLine}–${span.endLine}` : 'Open original evidence'}</button>;
            })}</div></> : <p>No unique supported link in this projection.</p>}
        </div>)}</div>
        {entry.status === 'support-unchanged' && entry.current && <button disabled={busy === key} onClick={() => void apply(entry.source.id, entry.current!.id)}>Apply to this index</button>}
        {entry.current && entry.status !== 'support-unchanged' && <button className="quiet" onClick={() => openCurrent(entry.current!.id)}>Open current link</button>}
      </details>)}
      {preview.omittedCorrections > 0 && <p>{preview.omittedCorrections} earlier corrections omitted by preview limits.</p>}
      <details className="earlier-review-gaps"><summary>Review scope and limits</summary>
        <p>Earlier index {preview.fromBuildId?.slice(0, 8) ?? 'unavailable'} → selected index {preview.buildId.slice(0, 8)}</p>
        {preview.scope.current.map(source => <p key={source.sourceId}>{source.name}: {preview.scope.previous.find(item => item.sourceId === source.sourceId)?.revision?.slice(0, 8) ?? 'new source'} → {source.revision?.slice(0, 8) ?? 'unavailable'}</p>)}
        <ul>{preview.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <p>At most {preview.limits.corrections} corrections from one chosen index, {preview.limits.ancestors} recorded ancestors and {preview.limits.outputBytes / 1024} KiB of preview.</p>
      </details>
    </>}
    <button className="quiet" disabled={busy === key} onClick={refresh}>Refresh comparison</button>
  </section>;
}

export function CorrectionOrigin({ origin, openEvidence }: { origin: NonNullable<CorrectionSummary['reappliedFrom']>; openEvidence(id: string): void }) {
  const [result, setResult] = useState<{ id: string; value: CorrectionHistory }>(), [error, setError] = useState('');
  const current = useRef(origin.id); current.current = origin.id;
  useEffect(() => { current.current = origin.id; return () => { current.current = ''; }; }, [origin.id]);
  async function read() {
    const id = origin.id; setError('');
    try { const value = await api<CorrectionHistory>(`/corrections/${encodeURIComponent(id)}/history`); if (current.current === id) setResult({ id, value }); }
    catch (cause) { if (current.current === id) setError((cause as Error).message); }
  }
  const version = result?.id === origin.id ? result.value.versions.find(item => item.id === origin.id) : undefined;
  return <div className="correction-origin"><p className="muted">Reapplied from index {origin.buildId.slice(0, 8)} · version {origin.version} · explicitly reviewed for this index</p>
    <button className="quiet" onClick={() => void read()}>Read earlier correction</button>
    {error && <p className="error" role="alert">{error}</p>}
    {version && <details open><summary>Earlier correction and original evidence</summary><p>{version.statement}</p>
      <p>Index {version.buildId.slice(0, 8)} · version {version.version} · engineer scope {version.environment ?? 'not specified'} · unverified</p>
      {version.original.evidenceIds.map((id, index) => <button key={id} className="quiet" onClick={() => openEvidence(id)}>Earlier evidence {index + 1}</button>)}
    </details>}
  </div>;
}
