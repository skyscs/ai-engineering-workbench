import { useState, type FormEvent } from 'react';
import { reasoningEfforts } from '@aew/core';
import type { ConnectionInput, ModelProfile, ModelProfileInput, WorkspaceInput } from '@aew/shared';

const defaultConnection: ConnectionInput = { name: 'Codex connection', executablePath: null, configProfile: null, configHome: null };

export function ConnectionFields({ value, onChange, locked = false, homeLocked = locked }: {
  value: ConnectionInput; onChange: (value: ConnectionInput) => void; locked?: boolean; homeLocked?: boolean;
}) {
  return <>
    <label>Connection name<input name="connectionName" required maxLength={120} value={value.name}
      onChange={(event) => onChange({ ...value, name: event.target.value })} /></label>
    <label>Configuration directory<input name="configHome" maxLength={4096} disabled={homeLocked}
      placeholder="Absolute path to your Codex configuration directory" value={value.configHome ?? ''}
      onChange={(event) => onChange({ ...value, configHome: event.target.value || null })} /></label>
    <p className="hint">Choose the directory for the intended personal or corporate connection. AI runs remain disabled until it is saved. Authentication stays in Codex.</p>
    <label>CLI configuration<select name="configMode" disabled={locked} value={value.configProfile === null ? 'default' : 'named'}
      onChange={(event) => onChange({ ...value, configProfile: event.target.value === 'default' ? null : '' })}>
      <option value="default">Base configuration in selected directory</option><option value="named">Named CLI profile</option>
    </select></label>
    {value.configProfile !== null && <label>CLI profile name<input name="configProfile" required maxLength={128}
      pattern="[A-Za-z0-9_-]+" disabled={locked} value={value.configProfile}
      onChange={(event) => onChange({ ...value, configProfile: event.target.value })} /></label>}
    <label>Codex executable path (optional)<input name="executablePath" maxLength={4096} disabled={locked}
      placeholder="Use codex from PATH" value={value.executablePath ?? ''}
      onChange={(event) => onChange({ ...value, executablePath: event.target.value || null })} /></label>
    <p className="hint">Use an absolute path for a custom executable. Authentication stays in your existing CLI setup.</p>
  </>;
}

export function WorkspaceCreate({ busy, onSave, onCancel }: {
  busy: boolean; onSave: (input: WorkspaceInput) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [connection, setConnection] = useState(defaultConnection);
  return <section className="panel"><h2>Create a workspace</h2>
    <p className="hint">Keep repositories and investigations within one AI connection.</p>
    <form aria-label="Create workspace" onSubmit={(event) => { event.preventDefault(); void onSave({ name, connection }); }}>
      <fieldset disabled={busy}>
        <label>Workspace name<input name="workspaceName" autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <ConnectionFields value={connection} onChange={setConnection} />
        <div className="actions"><button type="submit">Create workspace</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></div>
      </fieldset>
    </form>
  </section>;
}

export function ConnectionForm({ initial, locked, busy, onSave }: {
  initial: ConnectionInput; locked: boolean; busy: boolean; onSave: (value: ConnectionInput) => Promise<void>;
}) {
  const [value, setValue] = useState<ConnectionInput>({ name: initial.name,
    executablePath: initial.executablePath, configProfile: initial.configProfile, configHome: initial.configHome });
  return <form aria-label="Edit connection" onSubmit={(event) => { event.preventDefault(); void onSave(value); }}>
    <fieldset disabled={busy}>
      <ConnectionFields value={value} onChange={setValue} locked={locked} homeLocked={locked && initial.configHome !== null} />
      {locked && <p className="hint">This data boundary is locked. An unset directory can be bound once before any AI run history exists; otherwise create another workspace to change it.</p>}
      <button type="submit">Save connection</button>
    </fieldset>
  </form>;
}

export function ProfileForm({ initial, busy, onSave, onCancel }: {
  initial?: ModelProfile; busy: boolean; onSave: (value: ModelProfileInput) => Promise<boolean>; onCancel?: () => void;
}) {
  const empty: ModelProfileInput = { name: '', modelIdentifier: null, reasoningEffort: null };
  const [value, setValue] = useState<ModelProfileInput>(initial ?? empty);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await onSave({ name: value.name, modelIdentifier: value.modelIdentifier, reasoningEffort: value.reasoningEffort });
    if (saved && !initial) setValue(empty);
  }
  return <form aria-label={initial ? 'Edit model profile' : 'Create model profile'} onSubmit={(event) => void submit(event)}>
    <fieldset disabled={busy}>
      <label>Profile name<input name="profileName" required maxLength={120} value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
      <label>Model identifier (optional)<input name="modelIdentifier" maxLength={256} placeholder="Use the CLI default model"
        value={value.modelIdentifier ?? ''} onChange={(event) => setValue({ ...value, modelIdentifier: event.target.value || null })} /></label>
      <label>Reasoning effort<select name="reasoningEffort" value={value.reasoningEffort ?? ''}
        onChange={(event) => setValue({ ...value, reasoningEffort: event.target.value === '' ? null : event.target.value as ModelProfileInput['reasoningEffort'] })}>
        <option value="">CLI default</option>{reasoningEfforts.map((effort) => <option key={effort} value={effort}>{effort}</option>)}
      </select></label>
      <p className="hint">Model identifiers may come from a corporate provider. Availability and effort support have not been checked.</p>
      <div className="actions"><button type="submit">{initial ? 'Save profile' : 'Add profile'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}</div>
    </fieldset>
  </form>;
}
