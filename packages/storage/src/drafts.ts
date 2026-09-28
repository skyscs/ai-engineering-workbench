import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { DomainError, activeLaunchStates, identifier, parseDraftInput, type ArtifactLimits, type GitFailure, type DraftInput, type DraftFile, type InvestigationDraft, type LaunchOperation, type LaunchState } from '@aew/core';
import { transaction } from './tasks.js';
export type DraftStore = ReturnType<typeof createDraftStore>;
export function createDraftStore(db: DatabaseSync, ensureOpen: () => void, limits: ArtifactLimits) {
  const limit = Math.min(limits.contextBytes, limits.fileBytes, limits.taskBytes, 1024 * 1024);
  const columns = 'id, draft_id AS draftId, state, message, error_json AS errorJson, run_id AS runId, cancel_requested AS cancelRequested, created_at AS createdAt, updated_at AS updatedAt';
  function operation(id: string): LaunchOperation {
    ensureOpen(); const row = db.prepare(`SELECT ${columns} FROM investigation_launches WHERE id = ?`).get(id);
    if (!row) throw new DomainError('NOT_FOUND', 'Launch operation not found.');
    const { errorJson, ...value } = row;
    return { ...value, error: errorJson ? JSON.parse(String(errorJson)) : null, cancelRequested: row.cancelRequested === 1 } as unknown as LaunchOperation;
  }
  function get(id: string): InvestigationDraft {
    ensureOpen(); const row = db.prepare('SELECT * FROM investigation_drafts WHERE id = ?').get(id);
    if (!row) throw new DomainError('NOT_FOUND', 'Investigation draft not found.');
    const latest = db.prepare('SELECT id FROM investigation_launches WHERE draft_id = ? ORDER BY rowid DESC LIMIT 1').get(id);
    const files = db.prepare('SELECT id,name,length(bytes) AS size,included FROM draft_files WHERE draft_id = ? ORDER BY rowid').all(id).map(f => ({ ...f, included: f.included === 1 })) as unknown as DraftFile[];
    return { id, input: JSON.parse(String(row.input_json)) as DraftInput, revision: Number(row.revision), preserveContext: row.preserve_context === 1, taskId: row.task_id as string | null,
      files, launch: latest ? operation(String(latest.id)) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
  }
  function editable(id: string, revision?: number) {
    const draft = get(id);
    if (draft.taskId || draft.launch && activeLaunchStates.includes(draft.launch.state)) throw new DomainError('CONFLICT', 'This investigation has started. Create a new draft to change its original inputs.');
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision !== draft.revision)) throw new DomainError('CONFLICT', 'The draft changed in another request. Reload it before saving.');
    return draft;
  }
  function bump(id: string) { db.prepare('UPDATE investigation_drafts SET revision = revision + 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id); }
  function budget(description: string, bytes: number) {
    if (Buffer.byteLength(description) + bytes > limit) throw new DomainError('INVALID_INPUT', `Description and draft files must fit within ${limit} bytes. Use a smaller text file; content is never silently trimmed.`);
  }
  return {
    limit, get, operation,
    list() { ensureOpen(); return db.prepare('SELECT id FROM investigation_drafts ORDER BY updated_at DESC, rowid DESC LIMIT 200').all().map(row => get(String(row.id))); },
    create(id: string) {
      identifier(id); ensureOpen();
      if (!db.prepare('SELECT id FROM investigation_drafts WHERE id = ?').get(id)) {
        const now = new Date().toISOString();
        db.prepare('INSERT INTO investigation_drafts(id,input_json,created_at,updated_at) VALUES(?,?,?,?)').run(id, JSON.stringify({ workspaceId: null, repositoryIds: [], source: '', description: '', modelProfileId: null }), now, now);
      }
      return get(id);
    },
    adopt(id: string, input: DraftInput) {
      ensureOpen();
      if (!db.prepare('SELECT id FROM investigation_drafts WHERE id=?').get(id)) {
        const now = new Date().toISOString();
        db.prepare('INSERT INTO investigation_drafts(id,input_json,task_id,preserve_context,created_at,updated_at) VALUES(?,?,?,1,?,?)').run(id, JSON.stringify(input), id, now, now);
      }
      return get(id);
    },
    copy(id: string, nextId: string) {
      identifier(nextId);
      return transaction(db, () => {
        const original = get(id);
        if (db.prepare('SELECT id FROM investigation_drafts WHERE id=?').get(nextId)) throw new DomainError('CONFLICT', 'This draft identifier is already in use.');
        const now = new Date().toISOString();
        db.prepare('INSERT INTO investigation_drafts(id,input_json,created_at,updated_at) VALUES(?,?,?,?)').run(nextId, JSON.stringify(original.input), now, now);
        for (const file of original.files) db.prepare('INSERT INTO draft_files(id,draft_id,name,bytes,included) SELECT ?,?,name,bytes,included FROM draft_files WHERE id=?').run(randomUUID(), nextId, file.id);
        return get(nextId);
      });
    },
    save(id: string, revision: number, value: unknown) {
      const input = parseDraftInput(value);
      if (!Number.isSafeInteger(revision)) throw new DomainError('INVALID_INPUT', 'A saved draft revision is required.');
      return transaction(db, () => {
        editable(id, revision);
        budget(input.description, Number(db.prepare('SELECT coalesce(sum(length(bytes)),0) AS size FROM draft_files WHERE draft_id=?').get(id)!.size));
        db.prepare('UPDATE investigation_drafts SET input_json = ? WHERE id = ?').run(JSON.stringify(input), id); bump(id); return get(id);
      });
    },
    putFile(id: string, fileId: string, name: string, bytes: Uint8Array) {
      identifier(fileId);
      if (!name.trim() || name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(name) || !/\.(txt|log|md|markdown)$/i.test(name) || !bytes.length) throw new DomainError('INVALID_INPUT', 'Attach a nonempty .txt, .log or Markdown file. Images, PDFs and other formats are not analyzed.');
      try { if (new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\0')) throw new Error(); }
      catch { throw new DomainError('INVALID_INPUT', 'Attach valid UTF-8 text without binary data.'); }
      return transaction(db, () => {
        const draft = editable(id), existing = db.prepare('SELECT * FROM draft_files WHERE id=?').get(fileId);
        if (existing) {
          if (existing.draft_id !== id || existing.name !== name || !Buffer.from(existing.bytes as Uint8Array).equals(bytes)) throw new DomainError('CONFLICT', 'This upload identifier already belongs to another file.');
          return draft;
        }
        if (draft.files.length >= 32) throw new DomainError('INVALID_INPUT', 'A draft can include up to 32 files.');
        budget(draft.input.description, draft.files.reduce((n, f) => n + f.size, 0) + bytes.length);
        db.prepare('INSERT INTO draft_files(id,draft_id,name,bytes) VALUES(?,?,?,?)').run(fileId, id, name, bytes); bump(id); return get(id);
      });
    },
    changeFile(id: string, fileId: string, included: boolean | null) {
      return transaction(db, () => {
        editable(id);
        if (!db.prepare('SELECT id FROM draft_files WHERE id=? AND draft_id=?').get(fileId, id)) throw new DomainError('NOT_FOUND', 'Draft file not found.');
        if (included === null) db.prepare('DELETE FROM draft_files WHERE id=? AND draft_id=?').run(fileId, id);
        else db.prepare('UPDATE draft_files SET included=? WHERE id=? AND draft_id=?').run(included ? 1 : 0, fileId, id);
        bump(id); return get(id);
      });
    },
    fileBytes(id: string, fileId: string): Uint8Array {
      get(id); const row = db.prepare('SELECT bytes FROM draft_files WHERE draft_id=? AND id=?').get(id, fileId);
      if (!row) throw new DomainError('NOT_FOUND', 'Draft file not found.'); return row.bytes as Uint8Array;
    },
    discard(id: string) { transaction(db, () => { editable(id); db.prepare('DELETE FROM investigation_launches WHERE draft_id=?').run(id); db.prepare('DELETE FROM investigation_drafts WHERE id=?').run(id); }); },
    claim(id: string, requestId: string, revision: number) {
      identifier(requestId);
      return transaction(db, () => {
        const previous = db.prepare('SELECT draft_id FROM investigation_launches WHERE id=?').get(requestId);
        if (previous) { if (previous.draft_id !== id) throw new DomainError('CONFLICT', 'The request identifier belongs to another investigation.'); return { operation: operation(requestId), created: false }; }
        const draft = get(id);
        if (revision !== draft.revision) throw new DomainError('CONFLICT', 'Save and review the current draft before launching.');
        const busy = db.prepare("SELECT id FROM investigation_launches WHERE state IN ('checking','repositories','preparing','investigating')").get();
        if (busy) throw new DomainError('CONFLICT', 'Another investigation is preparing or running. Open it from the sidebar before starting another.');
        if (!draft.input.workspaceId || !draft.input.description.trim() || (!draft.input.source && !draft.input.repositoryIds.length)) throw new DomainError('INVALID_INPUT', 'Choose a project setup, a repository and a problem description.');
        const now = new Date().toISOString();
        db.prepare("INSERT INTO investigation_launches(id,draft_id,input_json,state,message,created_at,updated_at) VALUES(?,?,?,'checking','Checking selected setup',?,?)").run(requestId, id, JSON.stringify(draft.input), now, now);
        return { operation: operation(requestId), created: true };
      });
    },
    bindTask(id: string, taskId: string) { get(id); db.prepare('UPDATE investigation_drafts SET task_id = ?, updated_at = ? WHERE id=?').run(taskId, new Date().toISOString(), id); },
    preserveTaskContext(id: string) { get(id); db.prepare('UPDATE investigation_drafts SET preserve_context=1 WHERE id=? AND task_id IS NOT NULL').run(id); },
    advance(id: string, state: LaunchState, message: string, runId?: string, error?: GitFailure) {
      const op = operation(id);
      if (!activeLaunchStates.includes(op.state)) return op;
      db.prepare('UPDATE investigation_launches SET state=?,message=?,run_id=?,error_json=?,updated_at=? WHERE id=?').run(state, message.slice(0, 2048), runId ?? op.runId, error ? JSON.stringify(error) : null, new Date().toISOString(), id);
      return operation(id);
    },
    cancel(id: string) { const op = operation(id); if (activeLaunchStates.includes(op.state)) db.prepare('UPDATE investigation_launches SET cancel_requested=1 WHERE id=?').run(id); return operation(id); },
    interrupt() { db.prepare('UPDATE investigation_drafts SET task_id=id WHERE task_id IS NULL AND id IN (SELECT id FROM tasks)').run(); db.prepare("UPDATE investigation_launches SET state='failed', message='The application stopped before this attempt finished. Review any saved report and retry explicitly.', updated_at=? WHERE state IN ('checking','repositories','preparing','investigating')").run(new Date().toISOString()); }
  };
}
