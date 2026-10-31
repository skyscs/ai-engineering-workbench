import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { CorrectionHistory, CorrectionInput, CorrectionOverlay, CorrectionSummary, CorrectionTarget } from '../../loredock/src/correction-types';
import { api } from './api';
import { CorrectionOrigin } from './EarlierCorrections';

export function LinkCorrection({ buildId, targetKind, targetId, projectionHash, overlay, ready, changed, openEvidence }: {
  buildId: string; targetKind: CorrectionTarget; targetId: string; projectionHash: string;
  overlay: CorrectionOverlay | undefined; ready: boolean; changed(): void; openEvidence(id: string): void;
}) {
  const current = overlay?.corrections.find(item => item.targetKind === targetKind && item.targetId === targetId);
  const [draft, setDraft] = useState<{ baseId: string | null; action: 'dispute' | 'clarify'; statement: string; environment: string }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [history, setHistory] = useState<{ id: string; value: CorrectionHistory }>();
  const [showHistory, setShowHistory] = useState(false);
  const pending = useRef<{ signature: string; input: CorrectionInput } | undefined>(undefined);
  const alive = useRef(true), currentId = useRef(current?.id); currentId.current = current?.id;
  const field = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(withdraw = false) {
    if (!ready || !overlay?.editable || busy || !withdraw && !draft) return;
    setBusy(true); setError('');
    const content = { buildId, targetKind, targetId, projectionHash,
      expectedPreviousId: withdraw ? current!.id : draft!.baseId,
      action: withdraw ? 'withdraw' as const : draft!.action,
      statement: withdraw ? null : draft!.statement, environment: withdraw ? null : draft!.environment.trim() || null };
    const signature = JSON.stringify(content);
    if (pending.current?.signature !== signature) pending.current = { signature,
      input: { ...content, requestId: crypto.randomUUID(), expectedRevision: overlay.revision } };
    try {
      await api<CorrectionSummary>('/corrections', 'POST', pending.current.input);
      if (alive.current) { pending.current = undefined; setDraft(undefined); setShowHistory(false); changed(); }
    } catch (cause) { if (alive.current) { setError((cause as Error).message); changed(); } }
    finally { if (alive.current) setBusy(false); }
  }
  async function loadHistory() {
    if (!current || busy) return;
    const id = current.id; setShowHistory(true); setError('');
    try {
      const value = await api<CorrectionHistory>(`/corrections/${encodeURIComponent(id)}/history`);
      if (alive.current && currentId.current === id) setHistory({ id, value });
    } catch (cause) { if (alive.current && currentId.current === id) setError((cause as Error).message); }
  }
  const changedTarget = draft && draft.baseId !== (current?.id ?? null);
  return <div className="link-correction" data-target-id={targetId} data-target-kind={targetKind}>
    {current && current.action !== 'withdraw' && <aside className="human-correction">
      <strong>Engineer correction · {current.action === 'dispute' ? 'Disputed link' : 'Clarification'}</strong>
      <p className="correction-statement">{current.statement}</p>
      <p>Engineer scope: {current.environment ?? 'not specified'} · applies to this index only · unverified</p>
      <p className="muted">The original source claim stays visible. This note does not verify a runtime connection.</p>
      {current.reappliedFrom && <CorrectionOrigin origin={current.reappliedFrom} openEvidence={openEvidence} />}
    </aside>}
    {!ready && <p className="muted">Checking current engineer corrections…</p>}
    {ready && overlay?.editable && !draft && <button className="quiet" onClick={() => {
      pending.current = undefined; setError(''); setDraft({ baseId: current?.id ?? null,
        action: current?.action === 'clarify' ? 'clarify' : 'dispute', statement: current?.statement ?? '', environment: current?.environment ?? '' });
    }}>{current && current.action !== 'withdraw' ? 'Edit correction' : 'Correct this link'}</button>}
    {current && <button className="quiet correction-history-button" onClick={() => void loadHistory()}>Correction history ({current.version})</button>}
    {draft && <form className="correction-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }}>
      <label htmlFor={`${field}-action`}>What needs correcting?</label>
      <select id={`${field}-action`} value={draft.action} disabled={busy} onChange={event => { pending.current = undefined; setDraft({ ...draft, action: event.target.value as 'dispute' | 'clarify' }); }}>
        <option value="dispute">Dispute this link</option><option value="clarify">Clarify this link</option>
      </select>
      <label htmlFor={`${field}-statement`}>Your correction (English)</label>
      <textarea id={`${field}-statement`} rows={3} required value={draft.statement} disabled={busy} maxLength={2000}
        placeholder="Explain what is wrong or what context is missing."
        onChange={event => { pending.current = undefined; setDraft({ ...draft, statement: event.target.value }); }} />
      <details className="correction-scope"><summary>Environment scope (optional)</summary>
        <label htmlFor={`${field}-environment`}>Applies to environment</label>
        <input id={`${field}-environment`} value={draft.environment} maxLength={80} disabled={busy} placeholder="For example, local"
          onChange={event => { pending.current = undefined; setDraft({ ...draft, environment: event.target.value }); }} />
        <p>An engineer-supplied scope does not establish the active deployment environment.</p>
      </details>
      {changedTarget && <p className="notice">This link has a newer correction. Review it above before saving your draft.</p>}
      {(changedTarget || error) && <button type="button" disabled={busy || !ready} onClick={() => {
        pending.current = undefined; setDraft({ ...draft, baseId: current?.id ?? null }); setError('');
      }}>Use latest review</button>}
      <div className="correction-actions"><button type="submit" disabled={busy || !ready || changedTarget || !draft.statement.trim()}>Save correction</button>
        <button type="button" className="quiet" disabled={busy} onClick={() => { pending.current = undefined; setDraft(undefined); setError(''); }}>Cancel correction</button></div>
      <p className="muted">Saving marks dependent map flows for review. Ask Project continues to use original source evidence; no model is called.</p>
    </form>}
    {current && current.action !== 'withdraw' && !draft && ready && overlay?.editable && <button className="quiet" disabled={busy} onClick={() => void save(true)}>Withdraw correction</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {error && !draft && <button className="quiet" disabled={busy || !ready} onClick={() => { pending.current = undefined; setError(''); }}>Use latest review</button>}
    {showHistory && <div className="correction-history">
      <button className="quiet" onClick={() => setShowHistory(false)}>Hide correction history</button>
      {history?.id !== current?.id ? <p>Reading correction history… <button className="quiet" onClick={() => void loadHistory()}>Load latest history</button></p> : <ol>{history?.value.versions.map(version => <li key={version.id}>
        <strong>Version {version.version} · {version.action === 'withdraw' ? 'Withdrawn' : version.action === 'dispute' ? 'Disputed link' : 'Clarification'}</strong>
        <p>{version.statement ?? 'The engineer withdrew this correction.'}</p>
        {version.action !== 'withdraw' && <p>Engineer scope: {version.environment ?? 'not specified'} · unverified</p>}
        <p className="muted">{new Date(version.createdAt).toLocaleString()} · recorded for this index</p>
        {version.reappliedFrom && <CorrectionOrigin origin={version.reappliedFrom} openEvidence={openEvidence} />}
        <details><summary>Original relationship claim</summary><p>{version.original.from.sourceName} / {version.original.from.label} → {version.original.to.sourceName} / {version.original.to.label}</p>
          <p>{version.original.reason}</p><p>Original status: {version.original.status} · original scope: {version.original.environment ?? 'unspecified'}</p>
          <div className="correction-evidence">{version.original.evidenceIds.map((id, index) => <button className="quiet" key={id} onClick={() => openEvidence(id)}>Original evidence {index + 1}</button>)}</div>
        </details>
      </li>)}</ol>}
    </div>}
  </div>;
}
