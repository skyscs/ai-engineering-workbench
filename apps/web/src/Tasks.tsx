import { useEffect, useState } from 'react';
import type { ContextSelection, Repository, RepositoryList, Task, TaskDetail, WorkspaceDetail } from '@aew/shared';
import { api } from './api';
import { Runtime } from './Runtime';
import { Worktrees } from './Worktrees';

export function Tasks({ workspaceId, settings, csrf, disabled, setBusy, onCreated }: {
  workspaceId: string; settings: WorkspaceDetail; csrf: string | null; disabled: boolean; setBusy(value: boolean): void; onCreated(): Promise<void>;
}) {
  const base = `/workspaces/${workspaceId}/tasks`;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selections, setSelections] = useState<ContextSelection[]>([]);
  function display(value: TaskDetail) {
    setDetail(value);
    setSelections(value.context.entries.flatMap((entry) => entry.range ? [{ artifactId: entry.id, ...entry.range }] : []));
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'The task request failed.'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    const [list, repos] = await Promise.all([api<{ tasks: Task[] }>(base), api<RepositoryList>(`/workspaces/${workspaceId}/repositories`)]);
    setTasks(list.tasks); setRepositories(repos.repositories.filter((r) => r.status === 'ready'));
  }
  useEffect(() => { void perform(refresh); }, [workspaceId, csrf]);
  const headers = { 'content-type': 'application/json', 'x-aew-csrf': csrf ?? '' };
  const previewBytes = (detail?.context.descriptionBytes ?? 0) + selections.reduce((sum, s) => sum + s.end - s.start, 0);
  const contextBusy = disabled || (!!detail?.latestRun && ['queued', 'running'].includes(detail.latestRun.status));
  return <section className="panel" aria-label="Tasks">
    <div className="section-heading"><h2>Tasks</h2><div className="actions">
      <button disabled={disabled} onClick={() => void perform(async () => { await refresh(); setCreating(true); setDetail(null); })}>New task</button>
      <button className="secondary" disabled={disabled} onClick={() => void perform(async () => { await refresh(); if (detail) display(await api<TaskDetail>(`${base}/${detail.task.id}`)); })}>Refresh tasks</button>
    </div></div>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!tasks.length && <p className="hint">Create a task with one or more registered repositories.</p>}
    <ul className="workspace-list">{tasks.map((task) => <li key={task.id}><button className="secondary" disabled={disabled}
      aria-pressed={detail?.task.id === task.id} onClick={() => void perform(async () => { display(await api<TaskDetail>(`${base}/${task.id}`)); setCreating(false); })}>{task.title}</button></li>)}</ul>
    {creating && <form aria-label="Create task" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      void perform(async () => {
        const task = await api<Task>(base, { method: 'POST', headers, body: JSON.stringify({ title: data.get('title'), description: data.get('description'), repositoryIds: data.getAll('repositoryIds') }) });
        setCreating(false); await refresh(); display(await api<TaskDetail>(`${base}/${task.id}`)); await onCreated();
      });
    }}><fieldset disabled={disabled}><legend>Create a task</legend>
      <label>Task title<input name="title" required maxLength={120} /></label>
      <label>Description<textarea name="description" required maxLength={65536} rows={6} /></label>
      <p>Repositories (select at least one)</p>
      {repositories.map((repo) => <label className="check-label" key={repo.id}><input type="checkbox" name="repositoryIds" value={repo.id} />{repo.name}</label>)}
      {!repositories.length && <p>Add a ready repository above, then reopen this form.</p>}
      <p className="hint">Creating the first task permanently locks this workspace's AI connection launch settings.</p>
      <button type="submit" disabled={!repositories.length}>Create task</button>
    </fieldset></form>}
    {detail && <div aria-label="Task detail"><h3>{detail.task.title}</h3><p className="task-description">{detail.task.description}</p>
      <p className="hint">{detail.task.status === 'CONTEXT_READY' ? 'Context ready' : 'Created'} · context revision {detail.task.contextRevision}.</p>
      <p>Selected repositories: {detail.task.repositoryIds.map((id) => repositories.find((r) => r.id === id)?.name ?? id).join(', ')}</p>
      <Worktrees key={detail.task.id} detail={detail} csrf={csrf} disabled={disabled} update={setDetail} />
      <Runtime key={`runtime-${detail.task.id}`} detail={detail} settings={settings} csrf={csrf} disabled={disabled} update={setDetail} />
      {detail.imports.length > 0 && <details><summary>Incomplete imports ({detail.imports.length})</summary><ul>
        {detail.imports.map((item) => <li key={item.id}>{item.originalFilename}: {item.state} · {item.errorCode ?? 'In progress'}.
          {item.state === 'failed' ? ' Import the source again to retry.' : ' If the upload is no longer active, restart the daemon to recover it. RECOVERY_REQUIRED retains files for local repair.'}</li>)}
      </ul></details>}
      <form aria-label="Import artifacts" onSubmit={(event) => {
        event.preventDefault(); const form = event.currentTarget;
        const files = (form.elements.namedItem('files') as HTMLInputElement).files;
        if (!files?.length) return;
        void perform(async () => {
          let imported = 0;
          try {
            for (const file of Array.from(files)) {
              await api(`${base}/${detail.task.id}/artifacts`, { method: 'POST', headers: { 'x-aew-csrf': csrf ?? '',
                'x-aew-filename': encodeURIComponent(file.name), 'x-aew-file-size': String(file.size), 'content-type': file.type || 'application/octet-stream' }, body: file });
              imported++;
            }
            form.reset();
          } finally { display(await api<TaskDetail>(`${base}/${detail.task.id}`)); setNotice(`${imported} file(s) imported. Originals are preserved locally.`); }
        });
      }}><fieldset disabled={contextBusy}><legend>Import local artifacts</legend>
        <label>Files<input type="file" name="files" multiple required /></label>
        <p className="hint">Up to {detail.limits.fileBytes} bytes/file and {detail.limits.taskBytes} bytes/task. Imports are independent; a later failure preserves earlier files.</p>
        <button type="submit">Import files</button>
      </fieldset></form>
      <form aria-label="Select text context" onSubmit={(event) => {
        event.preventDefault(); void perform(async () => {
          await api(`${base}/${detail.task.id}/context`, { method: 'PUT', headers, body: JSON.stringify(selections) });
          display(await api<TaskDetail>(`${base}/${detail.task.id}`)); setNotice('Text context selection saved.');
        });
      }}><fieldset disabled={contextBusy}><legend>Text context preview</legend>
        <p>Description: {detail.context.descriptionBytes} bytes. Draft total: {previewBytes} / {detail.limits.contextBytes} bytes.</p>
        <p className="hint">Select UTF-8 text, Markdown or logs explicitly. Byte ranges include start and exclude end; choose complete characters. Oversized context is rejected without truncation. Download originals to inspect ranges. Saving context does not run AI.</p>
        {detail.context.entries.map((entry) => {
          const selected = selections.find((s) => s.artifactId === entry.id);
          return <article className="artifact-entry" key={entry.id}><strong>{entry.originalFilename}</strong>
            <p>{entry.byteSize} bytes · {entry.mimeType}</p><p className="artifact-hash">SHA-256: {entry.sha256}</p>
            <a href={`/api${base}/${detail.task.id}/artifacts/${entry.id}/download`} download>Download original</a>
            <p>{selected ? `Included in draft: bytes [${selected.start}, ${selected.end}).` : entry.kind === 'text' ? 'Excluded from draft text context.' : entry.reason}</p>
            {entry.kind === 'text' && entry.byteSize > 0 && <>
              <label className="check-label"><input type="checkbox" checked={!!selected} onChange={(event) => setSelections(event.target.checked ? [...selections, { artifactId: entry.id, start: 0, end: entry.byteSize }] : selections.filter((s) => s.artifactId !== entry.id))} />Include text</label>
              {selected && <div className="actions">{(['start', 'end'] as const).map((field) => <label key={field}>{field === 'start' ? 'Start byte' : 'End byte'}
                <input type="number" min={field === 'start' ? 0 : 1} max={entry.byteSize} step={1} required value={selected[field]}
                  onChange={(event) => setSelections(selections.map((s) => s.artifactId === entry.id ? { ...s, [field]: Number(event.target.value) } : s))} /></label>)}</div>}
            </>}
          </article>;
        })}
        <button type="submit" disabled={previewBytes > detail.limits.contextBytes}>Save text context</button>
      </fieldset></form>
    </div>}
  </section>;
}
