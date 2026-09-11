import { useEffect, useState } from 'react';
import type { Constraint, InterventionHistory, InvestigationReport } from '@aew/core';
import type { RuntimeDetail } from '@aew/shared';
import { api } from './api';

export function Interventions({ base, revision, runId, runStatus, report, reports, disabled, canChallenge, modelProfileId, submit, selectReport }: {
  base: string; revision: number; runId: string | undefined; runStatus: string | undefined;
  report: InvestigationReport | undefined; reports: InvestigationReport[]; disabled: boolean; canChallenge: boolean;
  modelProfileId: string | null; submit(route: string, body: unknown): Promise<void>; selectReport(id: string): void;
}) {
  const [history, setHistory] = useState<InterventionHistory[]>([]), [constraints, setConstraints] = useState<Constraint[]>([]);
  const [constraint, setConstraint] = useState(''), [challenge, setChallenge] = useState(''), [error, setError] = useState('');
  const [constraintRequest, setConstraintRequest] = useState(() => crypto.randomUUID());
  const [challengeRequest, setChallengeRequest] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState<RuntimeDetail | null>(null), [reading, setReading] = useState(false);
  useEffect(() => {
    let disposed = false;
    void api<{interventions: InterventionHistory[]; constraints: Constraint[]}>(`${base}/interventions`).then(value => {
      if (!disposed) { setHistory(value.interventions); setConstraints(value.constraints); }
    }).catch((e: Error) => { if (!disposed) setError(e.message); });
    return () => { disposed = true; };
  }, [base, revision, runId, runStatus]);
  async function send(type: 'constraint' | 'challenge') {
    setError('');
    try {
      await submit(`${base}/interventions`, type === 'constraint'
        ? { type, text: constraint, requestId: constraintRequest, expectedContextRevision: revision }
        : { type, text: challenge, targetReportId: report!.id, modelProfileId, requestId: challengeRequest, expectedContextRevision: revision });
      if (type === 'constraint') { setConstraint(''); setConstraintRequest(crypto.randomUUID()); }
      else { setChallenge(''); setChallengeRequest(crypto.randomUUID()); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Cannot save intervention. Refresh history before retrying.'); }
  }
  async function inspect(id: string) {
    setReading(true); setError(''); setAttempt(null);
    try { setAttempt(await api<RuntimeDetail>(`${base}/runtime-runs/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Cannot read the attempt.'); }
    finally { setReading(false); }
  }
  const version = (id: string | null) => reports.find(r => r.id === id)?.version;
  return <section aria-label="Human interventions"><h3>Human interventions</h3>
    <p className="hint">Constraints apply to subsequent runs. A challenge starts a new AI invocation using the selected model, current context and the exact report shown above. Existing reports stay available if the attempt fails.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <h4>Active constraints</h4>
    {!constraints.some(c => c.active) && <p>No active constraints.</p>}
    <ul>{constraints.filter(c => c.active).map(c => <li key={c.id}><p className="task-description">{c.text}</p>
      <button className="secondary" disabled={disabled} onClick={() => {
        setError(''); void submit(`${base}/constraints/${c.id}/deactivate`, { requestId: crypto.randomUUID(), expectedContextRevision: revision })
          .catch((e: Error) => setError(e.message));
      }}>Deactivate constraint</button></li>)}</ul>
    <form aria-label="Add constraint" onSubmit={e => { e.preventDefault(); void send('constraint'); }}>
      <fieldset disabled={disabled}><label>Persistent constraint<textarea name="constraintText" required maxLength={8192} value={constraint}
        onChange={e => { setConstraint(e.target.value); setConstraintRequest(crypto.randomUUID()); }} /></label>
        <p className="hint">Saving marks existing reports stale. It does not start an AI run.</p><button type="submit">Save constraint</button>
      </fieldset>
    </form>
    {report && <form aria-label="Challenge report" onSubmit={e => { e.preventDefault(); void send('challenge'); }}>
      <fieldset disabled={disabled || !canChallenge || report.status !== 'active'}>
        <label>Challenge version {report.version}<textarea name="challengeText" required maxLength={8192} value={challenge}
          onChange={e => { setChallenge(e.target.value); setChallengeRequest(crypto.randomUUID()); }} /></label>
        <button type="submit">Challenge and run</button>
      </fieldset>
      {report.status !== 'active' && <p>Choose the latest published version to challenge it.</p>}
    </form>}
    <details><summary>Intervention history (latest 100)</summary><ol>{history.map(i => <li key={i.id}>
      <p>{i.operation === 'challenge' ? `Challenge to version ${version(i.targetReportId) ?? '?'}` : i.operation === 'add_constraint' ? 'Constraint added' : 'Constraint deactivated'} · {i.createdAt}</p>
      <p className="task-description">{i.text}</p>
      {i.runId && <><p>Attempt: {i.runStatus}</p><button className="secondary" disabled={reading} onClick={() => void inspect(i.runId!)}>Inspect attempt</button></>}
      {i.reportId && <button className="secondary" onClick={() => selectReport(i.reportId!)}>Open version {version(i.reportId)}</button>}
    </li>)}</ol></details>
    {attempt && <section aria-label="Intervention attempt"><h4>Recorded attempt: {attempt.run.status}</h4>
      <p>Run {attempt.run.id}</p><p>Model: {attempt.run.inputSnapshot.profile?.modelIdentifier ?? 'CLI default'} · effort: {attempt.run.inputSnapshot.profile?.reasoningEffort ?? 'CLI default'}</p>
      {attempt.run.error && <p className="error">{attempt.run.error.code}: {attempt.run.error.message}<br />{attempt.run.error.stderr}</p>}
      <p>Constraint snapshot:</p><ul>{attempt.run.inputSnapshot.constraints.map((text, i) => <li key={i}>{text}</li>)}</ul>
    </section>}
  </section>;
}
