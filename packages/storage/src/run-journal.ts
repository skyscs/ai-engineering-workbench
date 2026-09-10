import type { DatabaseSync } from 'node:sqlite';
import { DomainError, type StageRun, type RunEvent } from '@aew/core';
import { transaction } from './tasks.js';

export function createRunJournal(db: DatabaseSync, get: (workspaceId: string, taskId: string, runId: string) => StageRun) {
  const limit = 10 * 1024 ** 2;
  function active(w: string, t: string, id: string) {
    const run = get(w, t, id);
    if (run.stage !== 'investigation' || run.status !== 'running') throw new DomainError('CONFLICT', 'Runtime data requires a running investigation.');
    db.prepare('INSERT OR IGNORE INTO run_execution (run_id) VALUES (?)').run(id);
  }
  function append(id: string, type: string, data: unknown) {
    const encoded = JSON.stringify(data), bytes = Buffer.byteLength(encoded) + Buffer.byteLength(type) + 128;
    const state = db.prepare('SELECT event_bytes, truncated FROM run_execution WHERE run_id = ?').get(id)!;
    if (state.truncated) return;
    const overflow = Number(state.event_bytes) + bytes > limit - 1024;
    const seq = Number(db.prepare('SELECT COALESCE(MAX(sequence), 0) AS seq FROM run_events WHERE run_id = ?').get(id)!.seq) + 1;
    db.prepare('INSERT INTO run_events VALUES (?, ?, ?, ?, ?)').run(id, seq, overflow ? 'truncated' : type,
      overflow ? JSON.stringify({ message: 'Persisted diagnostics reached the 10 MiB limit. Further events were omitted.' }) : encoded, new Date().toISOString());
    db.prepare('UPDATE run_execution SET event_bytes = event_bytes + ?, truncated = ? WHERE run_id = ?').run(overflow ? 256 : bytes, overflow || type === 'truncated' ? 1 : 0, id);
  }
  return {
    append(w: string, t: string, id: string, type: string, data: unknown) {
      if (!['progress', 'diagnostic', 'truncated'].includes(type)) throw new DomainError('INVALID_INPUT', 'Unsupported runtime event type.');
      transaction(db, () => { active(w, t, id); append(id, type, data); });
    },
    metadata(w: string, t: string, id: string, data: unknown) {
      transaction(db, () => { active(w, t, id);
        db.prepare('UPDATE run_execution SET metadata_json = ? WHERE run_id = ?').run(JSON.stringify(data), id);
        append(id, 'runtime', data);
      });
    },
    succeed(w: string, t: string, id: string, result: unknown): StageRun {
      const encoded = JSON.stringify(result);
      if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 2 * 1024 ** 2) throw new DomainError('INVALID_INPUT', 'Runtime result exceeds 2 MiB.');
      return transaction(db, () => {
        const run = get(w, t, id);
        if (['succeeded', 'failed', 'cancelled'].includes(run.status)) return run;
        active(w, t, id);
        if (!db.prepare('SELECT metadata_json FROM run_execution WHERE run_id = ?').get(id)!.metadata_json) throw new DomainError('CONFLICT', 'Runtime metadata must be recorded before success.');
        db.prepare('UPDATE run_execution SET result_json = ? WHERE run_id = ?').run(encoded, id);
        db.prepare("UPDATE stage_runs SET status = 'succeeded', completed_at = ? WHERE id = ? AND status = 'running'").run(new Date().toISOString(), id);
        return get(w, t, id);
      });
    },
    detail(w: string, t: string, id: string) {
      const run = get(w, t, id), row = db.prepare('SELECT * FROM run_execution WHERE run_id = ?').get(id);
      return { run, metadata: row?.metadata_json ? JSON.parse(String(row.metadata_json)) as unknown : null,
        result: row?.result_json ? JSON.parse(String(row.result_json)) as unknown : null, truncated: row?.truncated === 1 };
    },
    events(w: string, t: string, id: string, after = 0): RunEvent[] {
      get(w, t, id);
      if (!Number.isSafeInteger(after) || after < 0) throw new DomainError('INVALID_INPUT', 'Invalid event cursor.');
      return db.prepare('SELECT sequence, type, data_json, created_at AS createdAt FROM run_events WHERE run_id = ? AND sequence > ? ORDER BY sequence LIMIT 128').all(id, after)
        .map(({ data_json, ...row }) => ({ ...row, data: JSON.parse(String(data_json)) })) as RunEvent[];
    }
  };
}
