export const runtimeSchema = `
  CREATE TABLE run_execution (
    run_id TEXT PRIMARY KEY REFERENCES stage_runs(id) ON DELETE RESTRICT,
    metadata_json TEXT, result_json TEXT,
    event_bytes INTEGER NOT NULL DEFAULT 0, truncated INTEGER NOT NULL DEFAULT 0 CHECK(truncated IN (0, 1))
  ) STRICT;
  CREATE TABLE run_events (
    run_id TEXT NOT NULL REFERENCES stage_runs(id) ON DELETE RESTRICT,
    sequence INTEGER NOT NULL CHECK(sequence > 0), type TEXT NOT NULL,
    data_json TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(run_id, sequence)
  ) STRICT;
  CREATE TRIGGER run_event_immutable BEFORE UPDATE ON run_events
    BEGIN SELECT RAISE(ABORT, 'run_event_immutable'); END;
  CREATE TRIGGER run_metadata_immutable BEFORE UPDATE OF metadata_json ON run_execution
    WHEN OLD.metadata_json IS NOT NULL BEGIN SELECT RAISE(ABORT, 'run_metadata_immutable'); END;
  CREATE TRIGGER run_output_immutable BEFORE UPDATE OF result_json ON run_execution
    WHEN OLD.result_json IS NOT NULL BEGIN SELECT RAISE(ABORT, 'run_output_immutable'); END;
`;
