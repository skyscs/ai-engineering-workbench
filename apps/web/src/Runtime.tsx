import { useEffect, useState } from 'react';
import type { ModelProfile, RunEvent, RuntimeDetail, StageRun, TaskDetail, WorkspaceDetail } from '@aew/shared';
import { api } from './api';

export function Runtime({ detail, csrf, disabled, update }: {
  detail: TaskDetail; csrf: string | null; disabled: boolean; update(value: TaskDetail): void;
}) {
  const base = `/workspaces/${detail.task.workspaceId}/tasks/${detail.task.id}`;
  const [profiles, setProfiles] = useState<ModelProfile[]>([]), [profile, setProfile] = useState('');
  const [run, setRun] = useState<RuntimeDetail | null>(null), [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const latest = detail.latestRun?.stage === 'investigation' ? detail.latestRun : null;
  const active = !!detail.latestRun && ['queued', 'running'].includes(detail.latestRun.status);
  const headers = { 'content-type': 'application/json', 'x-aew-csrf': csrf ?? '' };
  useEffect(() => {
    let disposed = false;
    void api<WorkspaceDetail>(`/workspaces/${detail.task.workspaceId}`).then((value) => { if (!disposed) setProfiles(value.modelProfiles); }).catch((e: Error) => { if (!disposed) setError(e.message); });
    return () => { disposed = true; };
  }, [detail.task.workspaceId, csrf]);
  useEffect(() => {
    let disposed = false;
    setEvents([]); setRun(null);
    if (!latest) return;
    const id = latest.id;
    const refresh = async () => {
      const result = await api<RuntimeDetail>(`${base}/runtime-runs/${id}`);
      if (!disposed) setRun(result);
    };
    void refresh().catch((e: Error) => { if (!disposed) setError(e.message); });
    const source = new EventSource(`/api${base}/runtime-runs/${id}/events`);
    source.addEventListener('runtime', (event: MessageEvent<string>) => {
      const entry = JSON.parse(event.data) as RunEvent;
      setEvents((previous) => previous.some((v) => v.sequence === entry.sequence) ? previous : [...previous, entry].slice(-100));
    });
    source.addEventListener('complete', () => {
      source.close();
      void Promise.all([refresh(), api<TaskDetail>(base).then((value) => { if (!disposed) update(value); })]).catch((e: Error) => { if (!disposed) setError(e.message); });
    });
    source.onerror = () => { if (!disposed) setError('Event connection interrupted. Reconnecting; the run continues in the daemon. Refresh the task if the session expired.'); };
    source.onopen = () => { if (!disposed) setError(''); };
    return () => { disposed = true; source.close(); };
  }, [latest?.id, csrf]);
  async function start() {
    setBusy(true); setError('');
    try {
      await api<StageRun>(`${base}/runtime-runs`, { method: 'POST', headers, body: JSON.stringify({ modelProfileId: profile || null }) });
      update(await api<TaskDetail>(base));
    } catch (e) { setError(e instanceof Error ? e.message : 'Cannot start runtime.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="AI runtime" className="runtime-section"><h3>AI runtime preview</h3>
    <p className="hint">Run a preliminary read-only investigation using this workspace's Codex connection. Selected text ranges are supplied to the model; excluded files are not supplied. The CLI may send data to its configured provider. Verified evidence reports are planned for the next iteration.</p>
    <label>Model profile<select value={profile} disabled={disabled || busy || active} onChange={(e) => setProfile(e.target.value)}>
      <option value="">Use CLI model defaults</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <button disabled={disabled || busy || active || detail.worktrees.some((r) => r.status !== 'ready')} onClick={() => void start()}>Run preview</button>
    {error && <p role="alert" className="error">{error}</p>}
    {latest && <><p>Run {latest.id}: {run?.run.status ?? latest.status}</p>
      <p>Requested model: {latest.inputSnapshot.profile?.modelIdentifier ?? 'CLI default'} · effort: {latest.inputSnapshot.profile?.reasoningEffort ?? 'CLI default'}</p>
      {['queued', 'running'].includes(run?.run.status ?? latest.status) && <button className="secondary" disabled={busy} onClick={() => {
        setBusy(true); void api(`${base}/runtime-runs/${latest.id}/cancel`, { method: 'POST', headers, body: '{}' }).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
      }}>Cancel run</button>}
      {run?.run.error && <p className="error">{run.run.error.code}: {run.run.error.message}<br />{run.run.error.stderr}</p>}
      {run?.truncated && <p>Diagnostic output was truncated at the storage limit.</p>}
      <details><summary>Run events (latest 100)</summary><ol>{events.map((event) => <li key={event.sequence}>{event.sequence}. {event.type}: {typeof event.data === 'object' && event.data !== null && 'message' in event.data ? String(event.data.message) : 'Runtime configuration verified.'}</li>)}</ol></details>
      {run?.result && <div><h4>Preliminary result</h4><p className="task-description">{run.result.summary}</p><ul>{run.result.findings.map((text, index) => <li key={index}>{text}</li>)}</ul>
        <h4>Unresolved questions</h4>{run.result.unresolvedQuestions.length ? <ul>{run.result.unresolvedQuestions.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>None reported.</p>}</div>}
    </>}
  </section>;
}
