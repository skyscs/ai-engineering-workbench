import { useEffect, useState } from 'react';
import type { TaskDetail } from '@aew/shared';
import { api } from './api';

export function Worktrees({ detail, csrf, disabled, update }: { detail: TaskDetail; csrf: string | null; disabled: boolean; update(value: TaskDetail): void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const base = `/workspaces/${detail.task.workspaceId}/tasks/${detail.task.id}`;
  const active = !!detail.latestRun && ['queued', 'running'].includes(detail.latestRun.status);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const value = await api<TaskDetail>(base, { signal: controller.signal }); if (!controller.signal.aborted) update(value); }
      catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Refresh failed.'); }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 500);
    };
    timer = setTimeout(() => void poll(), 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [base, active]);
  async function change(route: string, method: string, body: unknown = {}) {
    setBusy(true); setError('');
    try {
      await api(`${base}/worktrees/${route}`, { method, headers: { 'content-type': 'application/json', 'x-aew-csrf': csrf ?? '' }, body: JSON.stringify(body) });
      update(await api<TaskDetail>(base));
    } catch (error) { setError(error instanceof Error ? error.message : 'The worktree operation failed.'); }
    finally { setBusy(false); }
  }
  const blocked = disabled || busy || active;
  return <section aria-label="Task worktrees" className="worktree-section"><h4>Task worktrees</h4>
    <p className="hint">Preparation checks out committed content in separate detached worktrees. Dirty changes in the original checkout are excluded. Revisions stay pinned after cleanup. Submodules are not initialized.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={blocked} onClick={() => void change('prepare', 'POST')}>Prepare worktrees</button>
    {detail.latestRun && <p role="status">Latest operation: {detail.latestRun.status}{detail.latestRun.error ? ` · ${detail.latestRun.error.message}` : ''}</p>}
    <ul className="worktree-list">{detail.worktrees.map((row) => <li key={row.repositoryId}>
      <strong>{row.repositoryName}</strong><p>Worktree: {row.status}</p>
      <form aria-label={`Base ref ${row.repositoryId}`} key={`${row.repositoryId}:${row.baseRef}`} onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget); void change(`${row.repositoryId}/base-ref`, 'PUT', { baseRef: form.get('baseRef') });
      }}><fieldset disabled={blocked || !!row.resolvedCommitSha || (!!row.operationId && row.status !== 'failed')}>
        <label>Base ref<input name="baseRef" defaultValue={row.baseRef ?? ''} placeholder="refs/heads/main" maxLength={256} required /></label><button type="submit" className="secondary">Save base ref</button>
      </fieldset></form>
      {row.worktreePath && <p>Path: <code>{row.worktreePath}</code></p>}
      {row.resolvedCommitSha && <p>Commit: <code>{row.resolvedCommitSha}</code><br />Retained pin: <code>{row.managedPinRef}</code></p>}
      {row.error && <div className="error"><p>{row.error.phase}: {row.error.code} · {row.error.message}</p>{row.error.stderr && <pre>{row.error.stderr}</pre>}</div>}
      {row.operationId && row.status !== 'removed' && <button className="secondary danger" disabled={blocked} onClick={() => {
        if (window.confirm('Remove this owned worktree if it is clean? Its revision pin and task history will be retained.')) void change(`${row.repositoryId}/cleanup`, 'POST');
      }}>Clean up worktree</button>}
    </li>)}</ul>
  </section>;
}
