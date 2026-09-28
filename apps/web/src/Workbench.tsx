import { useEffect, useRef, useState } from 'react';
import type { DraftInput, InvestigationDraft, LaunchOperation, Repository, Task, TaskDetail, Workspace, WorkspaceDetail } from '@aew/shared';
import { activeLaunchStates } from '@aew/core';
import { api } from './api';
import { Report } from './Report';
import './workbench.css';

const emptyInput: DraftInput = { workspaceId: null, repositoryIds: [], source: '', description: '', modelProfileId: null };
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not finish. Your saved inputs are preserved.';
const bytes = (size: number) => size < 1024 ? `${size} B` : `${Math.ceil(size / 1024)} KB`;
export function Workbench() {
  const [csrf, setCsrf] = useState(''), [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [drafts, setDrafts] = useState<InvestigationDraft[]>([]), [draft, setDraft] = useState<InvestigationDraft | null>(null);
  const [input, setInput] = useState<DraftInput>(emptyInput), [settings, setSettings] = useState<WorkspaceDetail | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]), [tasks, setTasks] = useState<Task[]>([]), [task, setTask] = useState<TaskDetail | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('Connecting…');
  const [limit, setLimit] = useState(1024 * 1024), [directories, setDirectories] = useState<string[]>([]);
  const [setupChoice, setSetupChoice] = useState(''), [customHome, setCustomHome] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), dialogOpener = useRef<HTMLElement | null>(null), upload = useRef<HTMLInputElement>(null);
  const current = useRef<InvestigationDraft | null>(null), inputRef = useRef(input), queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), action = useRef(false), launchKey = useRef<string | null>(null);
  const initialId = useRef(crypto.randomUUID());
  const headers = { 'content-type': 'application/json', 'x-aew-csrf': csrf };
  const op = draft?.launch;
  const launching = !!op && activeLaunchStates.includes(op.state);
  const running = !!task?.latestRun && ['running', 'queued'].includes(task.latestRun.status);
  const locked = !!draft?.taskId || launching;
  const w = input.workspaceId;
  const taskBase = task ? `/workspaces/${task.task.workspaceId}/tasks/${task.task.id}` : '';
  function updateDraft(value: InvestigationDraft) {
    if (value.launch && !activeLaunchStates.includes(value.launch.state) && launchKey.current === value.launch.id) launchKey.current = null;
    current.current = value; setDraft(value); setDrafts(old => [value, ...old.filter(d => d.id !== value.id)]);
  }
  function display(value: InvestigationDraft) {
    clearTimeout(timer.current); updateDraft(value); inputRef.current = value.input; setInput(value.input);
    setTask(null); setError(''); setSaved('Saved locally'); launchKey.current = null;
    history.replaceState(null, '', `#draft/${value.id}`);
  }
  async function refreshProjects() {
    const list = await api<{ workspaces: Workspace[] }>('/workspaces'); setWorkspaces(list.workspaces); return list.workspaces;
  }
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const session = await api<{ csrfToken: string }>('/session', { method: 'POST', headers: { 'x-aew-client': 'web' } });
      const [list, projects, options] = await Promise.all([api<{ drafts: InvestigationDraft[]; limitBytes: number }>('/drafts'), api<{ workspaces: Workspace[] }>('/workspaces'), api<{ directories: string[] }>('/drafts/setup-options')]);
      if (disposed) return;
      setCsrf(session.csrfToken); setDrafts(list.drafts); setWorkspaces(projects.workspaces); setDirectories(options.directories); setLimit(list.limitBytes);
      const requested = /^#draft\/([a-f0-9-]{36})$/.exec(location.hash)?.[1];
      const value = requested ? await api<InvestigationDraft>(`/drafts/${requested}`) : list.drafts[0] ?? await api<InvestigationDraft>('/drafts', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aew-csrf': session.csrfToken }, body: JSON.stringify({ id: initialId.current }) });
      if (!disposed) display(value);
    })().catch(e => { if (!disposed) { setError(message(e)); setSaved('Connection unavailable'); } });
    return () => { disposed = true; clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    let disposed = false;
    setSettings(null); setRepositories([]); setTasks([]);
    if (w) void Promise.all([api<WorkspaceDetail>(`/workspaces/${w}`), api<{ repositories: Repository[] }>(`/workspaces/${w}/repositories`), api<{ tasks: Task[] }>(`/workspaces/${w}/tasks`)]).then(([s, r, t]) => {
      if (!disposed) { setSettings(s); setRepositories(r.repositories); setTasks(t.tasks); }
    }).catch(e => { if (!disposed) setError(message(e)); });
    return () => { disposed = true; };
  }, [w, draft?.taskId]);
  function persist(value = inputRef.current): Promise<InvestigationDraft | null> {
    const id = current.current?.id;
    const work = queue.current.then(async () => {
      const previous = current.current;
      if (!previous || previous.id !== id || previous.taskId || (previous.launch && activeLaunchStates.includes(previous.launch.state))) return previous;
      if (JSON.stringify(previous.input) === JSON.stringify(value)) return previous;
      setSaved('Saving…');
      const result = await api<InvestigationDraft>(`/drafts/${id}`, { method: 'PUT', headers, body: JSON.stringify({ revision: previous.revision, input: value }) });
      if (current.current?.id === id) { updateDraft(result); setSaved('Saved locally'); }
      return result;
    });
    queue.current = work.catch(() => {}); return work;
  }
  function edit(value: DraftInput) { inputRef.current = value; setInput(value); setSaved('Unsaved changes'); }
  useEffect(() => {
    if (!csrf || !draft || locked) return;
    timer.current = setTimeout(() => { void persist(input).catch(e => { setError(message(e)); setSaved('Not saved — retry before leaving'); }); }, 450);
    return () => clearTimeout(timer.current);
  }, [input, csrf, draft?.id, locked]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (current.current && JSON.stringify(current.current.input) !== JSON.stringify(inputRef.current)) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  async function flush() { clearTimeout(timer.current); return await persist(); }
  async function perform(fn: () => Promise<void>) {
    if (action.current) return;
    action.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(message(e)); }
    finally { action.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!draft?.id) return;
    let disposed = false, timeout: ReturnType<typeof setTimeout>;
    const id = draft.id;
    const poll = async () => {
      try {
        const value = await api<InvestigationDraft>(`/drafts/${id}`);
        const detail = value.taskId && value.input.workspaceId ? await api<TaskDetail>(`/workspaces/${value.input.workspaceId}/tasks/${value.taskId}`) : null;
        if (!disposed) {
          if (value.launch) { updateDraft(value); if (!activeLaunchStates.includes(value.launch.state)) launchKey.current = null; }
          setTask(detail);
          if (value.launch && activeLaunchStates.includes(value.launch.state) || detail?.latestRun && ['running', 'queued'].includes(detail.latestRun.status)) timeout = setTimeout(() => void poll(), 1000);
        }
      } catch (e) { if (!disposed) { setError(`Connection interrupted. Reconnect before retrying. ${message(e)}`); timeout = setTimeout(() => void poll(), 3000); } }
    };
    if (locked) void poll();
    return () => { disposed = true; clearTimeout(timeout); };
  }, [draft?.id, launching, draft?.taskId, task?.latestRun?.id]);
  async function start() {
    const value = await flush(); if (!value) return;
    if (!value.input.workspaceId) { openSetup(); return; }
    const key = launchKey.current ?? crypto.randomUUID(); launchKey.current = key;
    await api<LaunchOperation>(`/drafts/${value.id}/launch`, { method: 'POST', headers, body: JSON.stringify({ requestId: key, revision: value.revision }) });
    updateDraft(await api<InvestigationDraft>(`/drafts/${value.id}`));
  }
  async function newInvestigation(projectId = inputRef.current.workspaceId) {
    await flush();
    const previous = inputRef.current;
    let value = await api<InvestigationDraft>('/drafts', { method: 'POST', headers, body: JSON.stringify({ id: crypto.randomUUID() }) });
    const same = projectId === previous.workspaceId;
    const next = { ...emptyInput, workspaceId: projectId, source: same ? previous.source : '', repositoryIds: same ? previous.repositoryIds : [], modelProfileId: same ? previous.modelProfileId : null };
    value = await api<InvestigationDraft>(`/drafts/${value.id}`, { method: 'PUT', headers, body: JSON.stringify({ revision: value.revision, input: next }) });
    display(value);
  }
  function openSetup() {
    dialogOpener.current = document.activeElement as HTMLElement;
    setSetupChoice(w ? `workspace:${w}` : ''); dialog.current?.showModal();
  }
  async function saveSetup(form: HTMLFormElement) {
    const data = new FormData(form); let projectId: string;
    if (setupChoice.startsWith('workspace:')) projectId = setupChoice.slice(10);
    else {
      const home = setupChoice === 'custom' ? customHome : setupChoice.slice(10);
      const name = String(data.get('projectName') || inputRef.current.source.split(/[/:]/).filter(Boolean).at(-1)?.replace(/\.git$/, '') || 'My project');
      const result = await api<WorkspaceDetail>('/workspaces', { method: 'POST', headers, body: JSON.stringify({ name, connection: {
        name: 'Codex setup', configHome: home, executablePath: data.get('executablePath') || null, configProfile: data.get('configProfile') || null
      } }) });
      projectId = result.workspace.id; await refreshProjects();
    }
    const value = { ...inputRef.current, workspaceId: projectId, repositoryIds: projectId === w ? inputRef.current.repositoryIds : [], modelProfileId: projectId === w ? inputRef.current.modelProfileId : null };
    edit(value); await persist(value); dialog.current?.close();
  }
  async function attach(files: File[]) {
    const value = await flush(); if (!value) return;
    for (const file of files) {
      if (file.size > limit) throw new Error(`${file.name} is too large. Attach a smaller text file (draft budget ${bytes(limit)}).`);
      const result = await api<InvestigationDraft>(`/drafts/${value.id}/files/${crypto.randomUUID()}`, { method: 'PUT', headers: { 'x-aew-csrf': csrf, 'x-aew-filename': encodeURIComponent(file.name) }, body: file });
      updateDraft(result);
    }
    setSaved('Files saved locally and included in analysis');
    if (upload.current) upload.current.value = '';
  }
  async function submitIntervention(route: string, body: unknown) {
    await api(route, { method: 'POST', headers, body: JSON.stringify(body) });
    setTask(await api<TaskDetail>(taskBase));
  }
  const status = launching ? op!.cancelRequested ? 'Cancelling after the current step…' : op!.message : running ? 'Investigation in progress' : task?.task.status === 'ROOT_CAUSE_READY' ? 'Report ready' : locked ? 'Investigation saved' : 'New investigation';
  const disabled = busy || !csrf || !draft;
  return <div className="workbench"><a className="skip" href="#content">Skip to investigation</a><div className="layout">
    <aside className="sidebar"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">w</span>Workbench</a>
      <button className="new-button" disabled={disabled || launching || running} onClick={() => void perform(() => newInvestigation())}>＋ New investigation</button>
      <p className="nav-caption">PROJECTS</p>{workspaces.map(project => <button key={project.id} className={`nav-item ${project.id === w ? 'selected' : ''}`} disabled={busy} onClick={() => void perform(() => newInvestigation(project.id))}>{project.name}</button>)}
      <p className="nav-caption">INVESTIGATIONS</p><div className="history-list">{drafts.filter(d => d.input.description || d.launch).map(d => <button className="history-item" key={d.id} aria-current={d.id === draft?.id ? 'page' : undefined} disabled={busy} onClick={() => void perform(async () => { await flush(); display(await api<InvestigationDraft>(`/drafts/${d.id}`)); })}>{d.input.description.slice(0, 65) || 'Untitled investigation'}<small>{d.launch ? activeLaunchStates.includes(d.launch.state) ? 'In progress' : d.launch.state === 'failed' ? 'Needs attention' : d.launch.state : 'Draft'}</small></button>)}
      {tasks.filter(t => !drafts.some(d => d.taskId === t.id)).map(t => <button className="history-item" key={t.id} disabled={busy} onClick={() => void perform(async () => { await flush(); display(await api<InvestigationDraft>('/drafts/from-task', { method: 'POST', headers, body: JSON.stringify({ workspaceId: w, taskId: t.id }) })); })}>{t.title}<small>Saved investigation</small></button>)}</div>
      <div className="sidebar-bottom"><a href="/advanced">Advanced settings</a><span className="local-dot" aria-hidden="true" /> Local</div>
    </aside><div className="workspace"><header className="topbar"><span>{settings?.workspace.name ?? 'Investigations'} / <strong>{status}</strong></span><button className="text-button" onClick={() => location.reload()}>Reconnect</button></header>
    <main id="content"><div className="page-heading"><div><h1>{locked ? task?.task.title ?? 'Your investigation' : 'New investigation'}</h1><p>{locked ? 'Follow the evidence. Keep every version.' : 'Describe a problem. Follow the code and its history.'}</p></div></div>
      {error && <div className="notice error" role="alert"><p>{error}</p><button className="text-button" onClick={() => void perform(async () => { await flush(); })}>Retry saving</button></div>}
      {op?.state === 'failed' && <div className="notice error" role="alert"><h2>This attempt needs attention</h2><p>{op.message}</p>{op.error && <details><summary>Technical details</summary><pre>{op.error.code}{op.error.exitCode !== null ? ` · exit ${op.error.exitCode}` : ''}{op.error.stderr ? `\n${op.error.stderr}` : ''}</pre></details>}<p>Your saved inputs and previous reports are preserved.</p>{!draft?.taskId && <button className="secondary" disabled={busy} onClick={openSetup}>Review setup</button>}</div>}
      {op?.state === 'cancelled' && <p className="notice" role="status">Investigation cancelled. Your inputs and previous reports are preserved.</p>}
      {launching || running ? <section className="card" aria-label="Investigation progress"><h2>{status}</h2><ol className="progress-list">{['Check selected setup', 'Resolve repositories', 'Prepare isolated code', 'Investigate the problem'].map((text, index) => {
        const phase = launching ? ['checking', 'repositories', 'preparing', 'investigating'].indexOf(op!.state) : 3;
        return <li key={text} className={index < phase ? 'done' : index === phase ? 'current' : ''} aria-current={index === phase ? 'step' : undefined}><span className="step-icon" aria-hidden="true">{index < phase ? '✓' : index === phase ? '' : index + 1}</span>{text}</li>;
      })}</ol><p className="muted">Work continues if you close this page. Cancellation never starts another analysis.</p><button className="secondary" disabled={busy || !!op?.cancelRequested && launching} onClick={() => void perform(async () => {
        if (launching) { await api(`/drafts/${draft!.id}/cancel`, { method: 'POST', headers, body: JSON.stringify({ requestId: op!.id }) }); updateDraft(await api<InvestigationDraft>(`/drafts/${draft!.id}`)); }
        else if (task?.latestRun) await api(`${taskBase}/runtime-runs/${task.latestRun.id}/cancel`, { method: 'POST', headers, body: '{}' });
      })}>Cancel investigation</button></section> : null}
      {!locked && <form className="card" aria-label="New investigation" onSubmit={event => { event.preventDefault(); void perform(start); }}><fieldset disabled={disabled}>
        <div className="field"><label htmlFor="repository">Repository path or Git URL</label><input id="repository" value={input.source} required={!input.repositoryIds.length} placeholder="/path/to/your/project" maxLength={4096} onChange={e => edit({ ...inputRef.current, source: e.target.value })} /><small>Local paths use current committed code. Uncommitted changes are excluded; your checkout stays unchanged.</small>
        {repositories.some(r => r.status === 'ready') && <details className="disclosure"><summary>Choose registered repositories</summary>{repositories.filter(r => r.status === 'ready').map(repo => <label className="check-label" key={repo.id}><input type="checkbox" checked={input.repositoryIds.includes(repo.id)} onChange={e => edit({ ...inputRef.current, repositoryIds: e.target.checked ? [...inputRef.current.repositoryIds, repo.id] : inputRef.current.repositoryIds.filter(id => id !== repo.id) })} />{repo.name}<small>{repo.baseRef} · {repo.resolvedCommitSha?.slice(0, 8)}</small></label>)}</details>}</div>
        <div className="field"><label htmlFor="description">What is going wrong?</label><textarea id="description" required maxLength={65536} value={input.description} placeholder="Describe the problem or paste the issue here. What happened, and what did you expect?" onChange={e => edit({ ...inputRef.current, description: e.target.value })} /></div>
        <div className="field"><div className="label-row"><label>Supporting files <span className="optional">Optional</span></label><small>{bytes(limit)} draft budget</small></div><div className="drop-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!disabled) void perform(() => attach(Array.from(e.dataTransfer.files))); }}><button type="button" className="text-button" onClick={() => upload.current?.click()}>Add files</button> or drop logs and text here<small>UTF-8 .txt, .log and Markdown. Saved files are included automatically.</small><input ref={upload} aria-label="Supporting files" type="file" multiple hidden onChange={e => { const files = Array.from(e.target.files ?? []); void perform(() => attach(files)); }} /></div>
        {draft?.files.map(file => <div className="attachment" key={file.id}><span className="file-icon">TXT</span><div className="attachment-info"><strong>{file.name}</strong><small className={file.included ? 'included' : 'excluded'}>{bytes(file.size)} · {file.included ? 'Included · full text' : 'Excluded from analysis'}</small></div><button type="button" className="text-button" onClick={() => void perform(async () => { await flush(); updateDraft(await api<InvestigationDraft>(`/drafts/${draft.id}/files/${file.id}`, { method: 'PATCH', headers, body: JSON.stringify({ included: !file.included }) })); })}>{file.included ? 'Exclude' : 'Include'}</button><button type="button" className="text-button" aria-label={`Remove ${file.name}`} onClick={() => void perform(async () => { await flush(); updateDraft(await api<InvestigationDraft>(`/drafts/${draft.id}/files/${file.id}`, { method: 'DELETE', headers })); })}>Remove</button></div>)}</div>
        <div className="setup-strip"><div><div className="setup-label">ANALYZE WITH</div><p><strong>{settings?.workspace.name ?? 'Choose your Codex setup'}</strong></p><small>{settings?.connection.configHome ?? 'Choose once. This project remembers your selection.'}</small></div><button type="button" className="secondary" onClick={openSetup}>{w ? 'Change' : 'Choose setup'}</button></div>
        <details className="disclosure"><summary>Advanced options</summary><label htmlFor="model">Model settings</label><select id="model" value={input.modelProfileId ?? ''} onChange={e => edit({ ...inputRef.current, modelProfileId: e.target.value || null })}><option value="">Codex defaults</option>{settings?.modelProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><p><a href="/advanced">Manage model profiles, repositories and setup settings</a></p><p>Setup checks run before task creation. They confirm local compatibility, not account identity or model availability.</p></details>
        <div className="submit-row"><p>Read-only analysis. Code and selected text may be sent through your chosen Codex setup.<br /><span role="status">{saved}</span></p><button className="primary" type="submit">{w ? 'Investigate →' : 'Choose setup →'}</button></div>
      </fieldset></form>}
      {locked && !launching && !running && <div className="actions investigation-actions"><button className="primary" disabled={busy} onClick={() => void perform(start)}>{op?.state === 'failed' || op?.state === 'cancelled' ? 'Retry investigation' : 'Run investigation again'}</button><button className="secondary" disabled={busy} onClick={() => void perform(async () => { await flush(); display(await api<InvestigationDraft>(`/drafts/${draft!.id}/copy`, { method: 'POST', headers, body: JSON.stringify({ id: crypto.randomUUID() }) })); })}>Copy to a new investigation</button></div>}
      {locked && <details className="card input-details"><summary>Inputs and recorded settings</summary><p className="task-description">{input.description}</p><p>Setup: {settings?.connection.configHome} · {settings?.modelProfiles.find(p => p.id === input.modelProfileId)?.name ?? 'Codex defaults'}</p>{task?.worktrees.map(repo => <p key={repo.repositoryId}>{repositories.find(r => r.id === repo.repositoryId)?.name ?? repo.repositoryId}: <code>{repo.resolvedCommitSha}</code></p>)}{task?.context.entries.map(file => <p key={file.id}>{file.originalFilename} · {file.range ? 'Included' : 'Excluded'}</p>)}{task?.latestRun?.error && <p className="error">{task.latestRun.error.code}: {task.latestRun.error.message}<br />{task.latestRun.error.stderr}</p>}</details>}
      {task && settings && <div className="card report-card"><Report base={taskBase} revision={task.task.contextRevision} runId={task.latestRun?.id} runStatus={task.latestRun?.status} disabled={busy || launching || running} canChallenge={!launching && !running && task.worktrees.every(r => r.status === 'ready')} modelProfileId={input.modelProfileId} submit={submitIntervention} simplified /></div>}
      {!locked && draft && <button className="text-button discard" disabled={busy} onClick={() => { if (confirm('Discard this draft and its saved files?')) void perform(async () => { await queue.current; clearTimeout(timer.current); await api(`/drafts/${draft.id}`, { method: 'DELETE', headers }); setDrafts(old => old.filter(d => d.id !== draft.id)); current.current = null; inputRef.current = emptyInput; await newInvestigation(null); }); }}>Discard draft</button>}
    </main></div></div>
    <dialog ref={dialog} aria-labelledby="setup-title" onClose={() => dialogOpener.current?.focus()}><div className="modal-heading"><h2 id="setup-title">Choose your Codex setup</h2><button aria-label="Close dialog" disabled={busy} onClick={() => dialog.current?.close()}>×</button></div><p>Choose the setup intended for this project. A directory name does not verify account identity.</p>{error && <p role="alert" className="error">{error}</p>}
      <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; void perform(() => saveSetup(form)); }}><fieldset disabled={busy}><legend>Saved projects</legend>{workspaces.map(project => <label className="setup-option" key={project.id}><input type="radio" name="setup" value={`workspace:${project.id}`} checked={setupChoice === `workspace:${project.id}`} onChange={e => setSetupChoice(e.target.value)} required /><span>{project.name}<small>Use this project's saved connection</small></span></label>)}
      <legend>Create a project with an existing setup</legend>{directories.map(dir => <label className="setup-option" key={dir}><input type="radio" name="setup" value={`directory:${dir}`} checked={setupChoice === `directory:${dir}`} onChange={e => setSetupChoice(e.target.value)} required /><span>{dir}<small>Existing directory · not an account identity check</small></span></label>)}
      <label className="setup-option"><input type="radio" name="setup" value="custom" checked={setupChoice === 'custom'} onChange={() => setSetupChoice('custom')} required /><span>Use another configuration directory</span></label>
      {setupChoice === 'custom' && <label>Configuration directory<input required placeholder="/absolute/path/to/configuration" value={customHome} onChange={e => setCustomHome(e.target.value)} /></label>}
      {setupChoice && !setupChoice.startsWith('workspace:') && <details className="disclosure"><summary>Advanced setup</summary><label>Project name<input name="projectName" maxLength={120} placeholder="Use repository name" /></label><label>Codex executable<input name="executablePath" placeholder="Use codex from PATH" /></label><label>Named CLI profile<input name="configProfile" placeholder="Use base configuration" /></label></details>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className="primary" disabled={!setupChoice}>Use this setup</button></div></fieldset></form>
    </dialog>
  </div>;
}
