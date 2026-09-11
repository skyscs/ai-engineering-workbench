import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, parseIntervention, parseMutationGuard, type Constraint, type Intervention, type InterventionHistory,
  type InterventionInput, type MutationGuard, type Task } from '@aew/core';
import { transaction } from './tasks.js';

export function createInterventionStore(db: DatabaseSync, tasks: {
  get(w: string, t: string): Task; editable(w: string, t: string): void; bump(t: string): void;
}) {
  const columns = 'i.id, i.task_id AS taskId, i.type, i.text, i.operation, i.target_report_id AS targetReportId, i.constraint_id AS constraintId, i.request_id AS requestId, i.context_revision AS contextRevision, i.created_at AS createdAt';
  function get(w: string, t: string, id: string): Intervention {
    tasks.get(w, t);
    const row = db.prepare(`SELECT ${columns} FROM interventions i WHERE i.id = ? AND i.task_id = ?`).get(id, t);
    if (!row) throw new DomainError('NOT_FOUND', 'Intervention not found in this task.');
    return row as unknown as Intervention;
  }
  function constraints(w: string, t: string): Constraint[] {
    tasks.get(w, t);
    return db.prepare(`SELECT id, task_id AS taskId, text, active, source_intervention_id AS sourceInterventionId,
      created_at AS createdAt, deactivated_at AS deactivatedAt FROM task_constraints WHERE task_id = ? ORDER BY created_at, rowid`).all(t)
      .map(row => ({ ...row, active: row.active === 1 })) as unknown as Constraint[];
  }
  function guard(w: string, t: string, input: MutationGuard) {
    tasks.editable(w, t);
    if (db.prepare('SELECT id FROM interventions WHERE task_id = ? AND request_id = ?').get(t, input.requestId)) {
      throw new DomainError('CONFLICT', 'This submission was already recorded. Refresh intervention history before retrying.');
    }
    if (tasks.get(w, t).contextRevision !== input.expectedContextRevision) throw new DomainError('CONFLICT', 'Task context changed. Refresh and review it before submitting.');
  }
  function insert(w: string, t: string, input: MutationGuard & {text: string}, operation: Intervention['operation'], target: string | null, constraint: string | null) {
    const id = randomUUID();
    db.prepare('INSERT INTO interventions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, t,
      operation === 'challenge' ? 'challenge' : 'constraint', input.text, operation, target, constraint,
      input.requestId, input.expectedContextRevision, new Date().toISOString());
    return get(w, t, id);
  }
  return {
    get, constraints,
    history(w: string, t: string): InterventionHistory[] {
      tasks.get(w, t);
      return db.prepare(`SELECT ${columns}, s.id AS runId, s.status AS runStatus, r.id AS reportId
        FROM interventions i LEFT JOIN stage_runs s ON s.triggered_by_intervention_id = i.id
        LEFT JOIN investigation_reports r ON r.stage_run_id = s.id
        WHERE i.task_id = ? ORDER BY i.created_at DESC, i.rowid DESC LIMIT 100`).all(t) as unknown as InterventionHistory[];
    },
    addConstraint(w: string, t: string, value: unknown) {
      const input = parseIntervention(value);
      if (input.type !== 'constraint') throw new DomainError('INVALID_INPUT', 'Expected a constraint.');
      return transaction(db, () => {
        guard(w, t, input);
        const active = constraints(w, t).filter(c => c.active);
        if (active.length >= 32 || Buffer.byteLength(input.text) + active.reduce((sum, c) => sum + Buffer.byteLength(c.text), 0) > 32768) {
          throw new DomainError('CONFLICT', 'Active constraints are limited to 32 entries and 32 KiB total. Deactivate an obsolete constraint first.');
        }
        const id = randomUUID(), intervention = insert(w, t, input, 'add_constraint', null, id);
        db.prepare('INSERT INTO task_constraints (id,task_id,text,source_intervention_id,created_at) VALUES (?, ?, ?, ?, ?)')
          .run(id, t, input.text, intervention.id, intervention.createdAt);
        tasks.bump(t);
        return intervention;
      });
    },
    deactivate(w: string, t: string, id: string, value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['requestId','expectedContextRevision'].includes(k))) throw new DomainError('INVALID_INPUT', 'Provide the request UUID and context revision.');
      const input = parseMutationGuard(value as Record<string, unknown>);
      return transaction(db, () => {
        guard(w, t, input);
        const constraint = constraints(w, t).find(c => c.id === id);
        if (!constraint) throw new DomainError('NOT_FOUND', 'Constraint not found in this task.');
        if (!constraint.active) throw new DomainError('CONFLICT', 'This constraint is already inactive.');
        const intervention = insert(w, t, { ...input, text: constraint.text }, 'deactivate_constraint', null, id);
        db.prepare('UPDATE task_constraints SET active = 0, deactivated_at = ? WHERE id = ?').run(intervention.createdAt, id);
        tasks.bump(t);
        return intervention;
      });
    },
    /** Called only within createRun's transaction so rejected runs cannot leave an orphan challenge. */
    prepareChallenge(w: string, t: string, input: Extract<InterventionInput, {type: 'challenge'}>) {
      if (!db.isTransaction) throw new DomainError('CONFLICT', 'A challenge must be recorded with its new run.');
      guard(w, t, input);
      const latest = db.prepare('SELECT id FROM investigation_reports WHERE task_id = ? ORDER BY version DESC LIMIT 1').get(t);
      if (latest?.id !== input.targetReportId) throw new DomainError('CONFLICT', 'This report is no longer the latest published version. Refresh before challenging it.');
      return insert(w, t, input, 'challenge', input.targetReportId, null);
    }
  };
}
