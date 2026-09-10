import { useEffect, useState } from 'react';
import type { Repository, RepositoryList, WorkspaceDetail } from '@aew/shared';
import { api } from './api';

export function Repositories({ detail, csrf, disabled, setBusy }: {
  detail: WorkspaceDetail; csrf: string | null; disabled: boolean; setBusy: (value: boolean) => void;
}) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [mode, setMode] = useState('existing');
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const route = `/workspaces/${detail.workspace.id}/repositories`;

  useEffect(() => {
    setError(null);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await api<RepositoryList>(route, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setRepositories(result.repositories);
        if (result.repositories.some((item) => item.status === 'cloning')) timer = setTimeout(() => void load(), 1000);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Cannot load repositories.'); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [detail, refresh, route]);

  async function submit() {
    if (disabled || !csrf) return;
    setBusy(true); setError(null); setNotice('');
    try {
      const result = await api<Repository>(route + (mode === 'clone' ? '/clone' : ''), { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-aew-csrf': csrf }, body: JSON.stringify({ name, source, baseRef: baseRef || null }) });
      setRepositories((previous) => [...previous, result]);
      setName(''); setSource(''); setBaseRef(''); setRefresh((value) => value + 1);
      setNotice(result.status === 'cloning' ? 'Clone started. You can leave this page and check its status later.' : 'Repository registered locally.');
    } catch (error) { setError(error instanceof Error ? error.message : 'The repository request failed.'); }
    finally { setBusy(false); }
  }

  return <section className="panel repositories"><div className="section-heading"><h2>Repositories</h2>
    <button className="secondary" disabled={disabled} onClick={() => { setError(null); setRefresh((value) => value + 1); }}>Refresh repositories</button></div>
    <div aria-live="polite">{error && <p role="alert" className="error">{error}</p>}{notice && <p>{notice}</p>}</div>
    {!repositories.length && <p className="hint">No repositories registered.</p>}
    <ul className="repository-list">{repositories.map((repository) => <li key={repository.id}>
      <details><summary><strong>{repository.name}</strong> · {repository.status}</summary>
        <dl><dt>Storage</dt><dd>{repository.managedClone ? 'Workbench-managed clone' : 'Existing checkout'}</dd>
          <dt>Local path</dt><dd>{repository.localPath}</dd>
          <dt>Origin</dt><dd>{repository.remoteUrl ?? 'No origin remote'}</dd>
          <dt>Base ref</dt><dd>{repository.baseRef ?? 'Not selected'}</dd>
          <dt>Resolved commit</dt><dd>{repository.resolvedCommitSha ?? 'No commit selected'}</dd></dl>
        {repository.status === 'ready' && !repository.resolvedCommitSha && <p className="hint">Empty repository. A commit is required before task preparation.</p>}
        {repository.shallow && <p className="hint">Shallow repository: historical evidence is incomplete.</p>}
        {repository.error && <div className="error"><p>{repository.error.code}: {repository.error.message}</p>
          <p>Exit code: {repository.error.exitCode ?? 'unavailable'}; signal: {repository.error.signal ?? 'none'}</p>
          {repository.error.stderr && <pre>{repository.error.stderr}</pre>}</div>}
        {repository.status === 'failed' && repository.retainedFiles && <p className="hint">Files may remain beside the checkout path. See the repository recovery guide before manual cleanup.</p>}
      </details>
    </li>)}</ul>
    <h3>Add a repository</h3>
    <p className="hint">Use repositories and Git configuration you trust. Git authentication stays in your system setup.</p>
    <form aria-label="Add repository" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={disabled}>
        <label>Source type<select name="repositoryMode" value={mode} onChange={(event) => { setMode(event.target.value); setSource(''); }}>
          <option value="existing">Existing local checkout</option><option value="clone">Clone into Workbench</option>
        </select></label>
        <label>Repository name<input name="repositoryName" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>{mode === 'existing' ? 'Absolute checkout path' : 'Repository URL or absolute local source path'}
          <input name="repositorySource" required maxLength={4096} value={source} onChange={(event) => setSource(event.target.value)} /></label>
        <label>Base ref (optional)<input name="repositoryBaseRef" maxLength={256} value={baseRef} placeholder="Detect from origin HEAD or the current branch"
          onChange={(event) => setBaseRef(event.target.value)} /></label>
        <p className="hint">If no default can be detected, specify a branch, tag or commit. Clones download history without checking out files; task worktrees come later.</p>
        <button type="submit">{mode === 'clone' ? 'Start clone' : 'Register repository'}</button>
      </fieldset>
    </form>
  </section>;
}
