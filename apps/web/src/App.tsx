import { useEffect, useState } from 'react';
import type { ModelProfile, Workspace, WorkspaceDetail, WorkspaceList } from '@aew/shared';
import { api } from './api';
import { ConnectionForm, ProfileForm, WorkspaceCreate } from './SettingsForms';
import { Repositories } from './Repositories';
import { Tasks } from './Tasks';

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [creating, setCreating] = useState(true);
  const [editingProfile, setEditingProfile] = useState<ModelProfile | null>(null);
  const [csrf, setCsrf] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  function fail(error: unknown) { setError(error instanceof Error ? error.message : 'The request failed.'); }
  async function reconnect(signal?: AbortSignal) {
    setBusy(true); setError(null); setNotice(''); setCsrf(null);
    try {
      const options = signal ? { signal } : {};
      const session = await api<{ csrfToken: string }>('/session', { ...options, method: 'POST', headers: { 'x-aew-client': 'web' } });
      const list = await api<WorkspaceList>('/workspaces', options);
      const current = detail && list.workspaces.some((item) => item.id === detail.workspace.id)
        ? await api<WorkspaceDetail>(`/workspaces/${detail.workspace.id}`, options) : null;
      if (!signal?.aborted) { setCsrf(session.csrfToken); setWorkspaces(list.workspaces); setDetail(current); setEditingProfile(null); }
    } catch (error) { if (!signal?.aborted) fail(error); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void reconnect(controller.signal);
    return () => controller.abort();
  }, []);

  async function open(id: string) {
    setBusy(true); setError(null); setNotice('');
    try { setDetail(await api<WorkspaceDetail>(`/workspaces/${id}`)); setCreating(false); setEditingProfile(null); }
    catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function change(route: string, method: string, body?: unknown): Promise<boolean> {
    if (!csrf || busy) return false;
    setBusy(true); setError(null); setNotice('');
    let saved = false;
    try {
      const result = await api<unknown>(route, { method, headers: { 'content-type': 'application/json', 'x-aew-csrf': csrf },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      saved = true;
      const list = await api<WorkspaceList>('/workspaces');
      setWorkspaces(list.workspaces);
      if (route === '/workspaces' && method === 'POST') {
        setDetail(result as WorkspaceDetail); setCreating(false);
      } else if (detail && list.workspaces.some((item) => item.id === detail.workspace.id)) {
        setDetail(await api<WorkspaceDetail>(`/workspaces/${detail.workspace.id}`));
      } else { setDetail(null); setCreating(list.workspaces.length === 0); }
      setEditingProfile(null); setNotice('Changes saved locally.');
      return true;
    } catch (error) {
      fail(saved ? new Error('The change was saved, but refreshing failed. Refresh before making another change.') : error);
      return false;
    } finally { setBusy(false); }
  }
  const disabled = busy || !csrf;
  const base = detail ? `/workspaces/${detail.workspace.id}` : '';
  return <main className="shell">
    <header className="page-header"><div><p className="eyebrow">Local-first developer tool</p><h1>AI Engineering Workbench</h1>
      <p className="lede">Organize your engineering work and its AI data boundary.</p></div>
      <div className="status" aria-live="polite"><span className="status-dot" data-state={csrf ? 'ok' : error ? 'error' : 'pending'} />
        {csrf ? 'Local daemon connected.' : busy ? 'Connecting to local daemon…' : 'Daemon connection unavailable.'}</div>
    </header>
    <div className="feedback" aria-live="polite">{error && <p role="alert" className="error">{error}</p>}{notice && <p>{notice}</p>}</div>
    <div className="workspace-layout">
      <aside className="panel sidebar"><div className="section-heading"><h2>Workspaces</h2><button className="secondary" disabled={busy} onClick={() => void reconnect()}>Refresh</button></div>
        <button disabled={disabled} onClick={() => { setCreating(true); setEditingProfile(null); setNotice(''); }}>New workspace</button>
        {!workspaces.length && !busy && <p className="hint">No workspaces yet. Create one to save your connection settings.</p>}
        <ul className="workspace-list">{workspaces.map((workspace) => <li key={workspace.id}>
          <button className="workspace-item" disabled={disabled} aria-pressed={!creating && detail?.workspace.id === workspace.id}
            onClick={() => void open(workspace.id)}>{workspace.name}</button>
        </li>)}</ul>
      </aside>
      <div className="workspace-content">
        {creating ? <WorkspaceCreate busy={disabled} onSave={async (input) => { await change('/workspaces', 'POST', input); }} onCancel={() => setCreating(false)} />
          : detail ? <>
            <section className="panel"><div className="section-heading"><h2>{detail.workspace.name}</h2>
              <button className="danger secondary" disabled={disabled || detail.workspace.boundaryLocked} onClick={() => {
                if (window.confirm('Delete this workspace, its connection settings and all model profiles?')) void change(base, 'DELETE');
              }}>Delete workspace</button></div>
              <form key={detail.workspace.updatedAt} aria-label="Rename workspace" onSubmit={(event) => {
                event.preventDefault(); const data = new FormData(event.currentTarget); void change(base, 'PATCH', { name: data.get('name') });
              }}><fieldset disabled={disabled}><label>Workspace name<input name="name" required maxLength={120} defaultValue={detail.workspace.name} /></label><button type="submit" className="secondary">Rename workspace</button></fieldset></form>
            </section>
            <Repositories key={detail.workspace.id} detail={detail} csrf={csrf} disabled={disabled} setBusy={setBusy} />
            <Tasks key={`tasks:${detail.workspace.id}`} workspaceId={detail.workspace.id} csrf={csrf} disabled={disabled} setBusy={setBusy} onCreated={() => open(detail.workspace.id)} />
            <section className="panel"><div className="section-heading"><h2>AI connection</h2><span className="badge">Configured · not verified</span></div>
              <p className="hint">Settings are saved locally. Authentication, provider identity and runtime access have not been checked.</p>
              <ConnectionForm key={`${detail.connection.id}:${detail.connection.updatedAt}`} initial={detail.connection} locked={detail.workspace.boundaryLocked}
                busy={disabled} onSave={async (value) => { await change(`${base}/connection`, 'PUT', value); }} />
            </section>
            <section className="panel"><h2>Model profiles</h2><p className="hint">Each profile belongs to this workspace's AI connection.</p>
              {!detail.modelProfiles.length && <p>No model profiles yet.</p>}
              <ul className="profile-list">{detail.modelProfiles.map((profile) => <li key={profile.id}>
                <div><strong>{profile.name}</strong><p className="hint">{profile.modelIdentifier ?? 'CLI default model'} · {profile.reasoningEffort ?? 'CLI default effort'}</p></div>
                <div className="actions"><button className="secondary" disabled={disabled} onClick={() => setEditingProfile(profile)}>Edit</button>
                  <button className="secondary danger" disabled={disabled} onClick={() => {
                    if (window.confirm(`Delete model profile "${profile.name}"?`)) void change(`${base}/model-profiles/${profile.id}`, 'DELETE');
                  }}>Delete</button></div>
              </li>)}</ul>
              <h3>{editingProfile ? 'Edit model profile' : 'Add a model profile'}</h3>
              <ProfileForm key={editingProfile?.id ?? detail.workspace.id} {...(editingProfile ? { initial: editingProfile, onCancel: () => setEditingProfile(null) } : {})}
                busy={disabled} onSave={(value) => change(`${base}/model-profiles${editingProfile ? `/${editingProfile.id}` : ''}`, editingProfile ? 'PUT' : 'POST', value)} />
            </section>
          </> : <section className="panel"><h2>Select a workspace</h2><p>Choose a workspace or create one to configure its AI connection.</p></section>}
      </div>
    </div>
  </main>;
}
