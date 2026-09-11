import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, type InvestigationReport, type StageRun, type Task } from '@aew/core';
import { investigationVersion, validateInvestigation } from '@aew/workflow';
import type { createRunJournal } from './run-journal.js';

export function createInvestigationStore(db: DatabaseSync, task: (w: string, t: string) => Task,
  run: (w: string, t: string, id: string) => StageRun, journal: ReturnType<typeof createRunJournal>) {
  function get(w: string, t: string, id: string): InvestigationReport {
    const current = task(w, t);
    const row = db.prepare(`SELECT id, root_cause_id AS rootCauseId, task_id AS taskId, stage_run_id AS stageRunId,
      version, context_revision AS contextRevision, result_json, created_at AS createdAt,
      CASE WHEN version = (SELECT MAX(version) FROM investigation_reports WHERE task_id = ?) THEN 'active' ELSE 'superseded' END AS status
      FROM investigation_reports WHERE id = ? AND task_id = ?`).get(t, id, t);
    if (!row) throw new DomainError('NOT_FOUND', 'Investigation report not found in this task.');
    const { result_json, ...fields } = row;
    return { ...fields, freshness: row.contextRevision === current.contextRevision ? 'fresh' : 'stale', result: JSON.parse(String(result_json)) } as InvestigationReport;
  }
  return {
    get,
    list(w: string, t: string): InvestigationReport[] {
      task(w, t);
      return db.prepare('SELECT id FROM investigation_reports WHERE task_id = ? ORDER BY version DESC').all(t).map(row => get(w, t, String(row.id)));
    },
    publish(w: string, t: string, id: string, value: unknown) {
      if (!validateInvestigation(value)) throw new DomainError('INVALID_INPUT', 'Invalid investigation and root-cause pair.');
      const attempt = run(w, t, id);
      if (attempt.inputSnapshot.schemaVersion !== investigationVersion) throw new DomainError('CONFLICT', 'Only an investigation run can publish a report.');
      // The callback runs inside the same transaction as immutable output and success.
      return journal.succeed(w, t, id, value, () => {
        if (task(w, t).contextRevision !== attempt.inputSnapshot.context.revision) throw new DomainError('CONFLICT', 'Investigation context changed before publication.');
        const version = Number(db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM investigation_reports WHERE task_id = ?').get(t)!.next);
        db.prepare('INSERT INTO investigation_reports VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), randomUUID(), t, id,
          version, attempt.inputSnapshot.context.revision, JSON.stringify(value), new Date().toISOString());
      });
    }
  };
}
