export const investigationSchema = `
  CREATE UNIQUE INDEX stage_run_task_key ON stage_runs(id, task_id);
  CREATE TABLE investigation_reports (
    id TEXT PRIMARY KEY, root_cause_id TEXT NOT NULL UNIQUE,
    task_id TEXT NOT NULL, stage_run_id TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL CHECK(version > 0), context_revision INTEGER NOT NULL,
    result_json TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(task_id, version),
    FOREIGN KEY(stage_run_id, task_id) REFERENCES stage_runs(id, task_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE TRIGGER investigation_report_immutable BEFORE UPDATE ON investigation_reports
    BEGIN SELECT RAISE(ABORT, 'investigation_report_immutable'); END;
  CREATE TRIGGER investigation_report_retained BEFORE DELETE ON investigation_reports
    BEGIN SELECT RAISE(ABORT, 'investigation_report_retained'); END;
`;
