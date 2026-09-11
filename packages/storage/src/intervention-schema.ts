export const interventionSchema = `
  CREATE UNIQUE INDEX report_task_key ON investigation_reports(id, task_id);
  CREATE TABLE interventions (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK(type IN ('challenge','constraint')), text TEXT NOT NULL,
    operation TEXT NOT NULL, target_report_id TEXT, constraint_id TEXT,
    request_id TEXT NOT NULL, context_revision INTEGER NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(id, task_id), UNIQUE(task_id, request_id),
    CHECK((type = 'challenge' AND operation = 'challenge' AND target_report_id IS NOT NULL AND constraint_id IS NULL)
      OR (type = 'constraint' AND operation IN ('add_constraint','deactivate_constraint') AND target_report_id IS NULL AND constraint_id IS NOT NULL)),
    FOREIGN KEY(target_report_id, task_id) REFERENCES investigation_reports(id, task_id) ON DELETE RESTRICT,
    FOREIGN KEY(constraint_id, task_id) REFERENCES task_constraints(id, task_id) DEFERRABLE INITIALLY DEFERRED
  ) STRICT;
  CREATE TABLE task_constraints (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    text TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    source_intervention_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, deactivated_at TEXT,
    UNIQUE(id, task_id),
    FOREIGN KEY(source_intervention_id, task_id) REFERENCES interventions(id, task_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE TRIGGER intervention_immutable BEFORE UPDATE ON interventions
    BEGIN SELECT RAISE(ABORT, 'intervention_immutable'); END;
  CREATE TRIGGER intervention_retained BEFORE DELETE ON interventions
    BEGIN SELECT RAISE(ABORT, 'intervention_retained'); END;
  CREATE TRIGGER constraint_identity_immutable BEFORE UPDATE OF id,task_id,text,source_intervention_id,created_at ON task_constraints
    BEGIN SELECT RAISE(ABORT, 'constraint_identity_immutable'); END;
  CREATE TRIGGER constraint_deactivation BEFORE UPDATE OF active,deactivated_at ON task_constraints
    WHEN OLD.active != 1 OR NEW.active != 0 OR NEW.deactivated_at IS NULL
    BEGIN SELECT RAISE(ABORT, 'constraint_deactivation_only'); END;
  CREATE TRIGGER constraint_retained BEFORE DELETE ON task_constraints
    BEGIN SELECT RAISE(ABORT, 'constraint_retained'); END;
  ALTER TABLE stage_runs ADD COLUMN previous_version_id TEXT REFERENCES investigation_reports(id) ON DELETE RESTRICT;
  ALTER TABLE stage_runs ADD COLUMN triggered_by_intervention_id TEXT REFERENCES interventions(id) ON DELETE RESTRICT;
  CREATE UNIQUE INDEX intervention_run_key ON stage_runs(triggered_by_intervention_id) WHERE triggered_by_intervention_id IS NOT NULL;
  CREATE TRIGGER run_revision_immutable BEFORE UPDATE OF previous_version_id,triggered_by_intervention_id ON stage_runs
    BEGIN SELECT RAISE(ABORT, 'run_revision_immutable'); END;
  CREATE TRIGGER run_revision_owner BEFORE INSERT ON stage_runs
    WHEN (NEW.previous_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM investigation_reports WHERE id = NEW.previous_version_id AND task_id = NEW.task_id))
      OR (NEW.triggered_by_intervention_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM interventions WHERE id = NEW.triggered_by_intervention_id
        AND task_id = NEW.task_id AND type = 'challenge' AND target_report_id = NEW.previous_version_id))
    BEGIN SELECT RAISE(ABORT, 'run_revision_owner_mismatch'); END;

  CREATE TABLE result_dependencies (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    dependent_id TEXT NOT NULL, upstream_id TEXT NOT NULL,
    PRIMARY KEY(task_id, dependent_id, upstream_id)
  ) STRICT;
  CREATE TABLE result_invalidations (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    result_id TEXT NOT NULL, context_revision INTEGER NOT NULL,
    PRIMARY KEY(task_id, result_id)
  ) STRICT;
  INSERT INTO result_dependencies SELECT task_id, id, 'context:' || task_id FROM investigation_reports;
  INSERT INTO result_dependencies SELECT task_id, root_cause_id, id FROM investigation_reports;
  INSERT INTO result_invalidations
    SELECT r.task_id, r.id, t.context_revision FROM investigation_reports r JOIN tasks t ON t.id = r.task_id WHERE r.context_revision != t.context_revision;
  INSERT INTO result_invalidations
    SELECT r.task_id, r.root_cause_id, t.context_revision FROM investigation_reports r JOIN tasks t ON t.id = r.task_id WHERE r.context_revision != t.context_revision;
  CREATE TRIGGER report_dependencies AFTER INSERT ON investigation_reports BEGIN
    INSERT INTO result_dependencies VALUES (NEW.task_id, NEW.id, 'context:' || NEW.task_id);
    INSERT INTO result_dependencies VALUES (NEW.task_id, NEW.root_cause_id, NEW.id);
  END;
  CREATE TRIGGER invalidate_context_dependents AFTER UPDATE OF context_revision ON tasks
    WHEN NEW.context_revision != OLD.context_revision BEGIN
      INSERT OR IGNORE INTO result_invalidations
      SELECT NEW.id, id, NEW.context_revision FROM (
        WITH RECURSIVE affected(id) AS (
          SELECT dependent_id FROM result_dependencies WHERE task_id = NEW.id AND upstream_id = 'context:' || NEW.id
          UNION
          SELECT d.dependent_id FROM result_dependencies d JOIN affected a ON d.upstream_id = a.id WHERE d.task_id = NEW.id
        ) SELECT id FROM affected
      );
  END;
  CREATE TRIGGER dependency_immutable BEFORE UPDATE ON result_dependencies BEGIN SELECT RAISE(ABORT, 'dependency_immutable'); END;
  CREATE TRIGGER dependency_retained BEFORE DELETE ON result_dependencies BEGIN SELECT RAISE(ABORT, 'dependency_retained'); END;
  CREATE TRIGGER invalidation_immutable BEFORE UPDATE ON result_invalidations BEGIN SELECT RAISE(ABORT, 'invalidation_immutable'); END;
  CREATE TRIGGER invalidation_retained BEFORE DELETE ON result_invalidations BEGIN SELECT RAISE(ABORT, 'invalidation_retained'); END;
`;
