export const taskSchema = `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    title TEXT NOT NULL, description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK(status = 'CREATED'),
    context_revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(id, workspace_id)
  ) STRICT;
  CREATE UNIQUE INDEX repository_owner_key ON repositories(id, workspace_id);
  CREATE TABLE task_repositories (
    task_id TEXT NOT NULL, workspace_id TEXT NOT NULL, repository_id TEXT NOT NULL,
    base_ref TEXT, resolved_commit_sha TEXT,
    PRIMARY KEY(task_id, repository_id),
    FOREIGN KEY(task_id, workspace_id) REFERENCES tasks(id, workspace_id) ON DELETE RESTRICT,
    FOREIGN KEY(repository_id, workspace_id) REFERENCES repositories(id, workspace_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE TRIGGER task_owner_immutable BEFORE UPDATE OF workspace_id ON tasks
    BEGIN SELECT RAISE(ABORT, 'task_owner_immutable'); END;
  CREATE TABLE artifact_imports (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL DEFAULT 'artifact_import' CHECK(kind = 'artifact_import'),
    destination TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL CHECK(state IN ('uploading', 'prepared', 'ready', 'failed')),
    original_filename TEXT NOT NULL, mime_type TEXT NOT NULL, expected_size INTEGER NOT NULL CHECK(expected_size >= 0),
    sha256 TEXT, error_code TEXT, created_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX one_import_per_task ON artifact_imports(task_id) WHERE state IN ('uploading', 'prepared');
  CREATE TABLE artifacts (
    id TEXT PRIMARY KEY REFERENCES artifact_imports(id) ON DELETE RESTRICT,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    original_filename TEXT NOT NULL, mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL CHECK(byte_size >= 0), sha256 TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('text', 'image', 'unsupported')), created_at TEXT NOT NULL,
    UNIQUE(id, task_id)
  ) STRICT;
  CREATE TRIGGER artifact_immutable BEFORE UPDATE ON artifacts
    BEGIN SELECT RAISE(ABORT, 'artifact_immutable'); END;
  CREATE TABLE artifact_context (
    artifact_id TEXT PRIMARY KEY, task_id TEXT NOT NULL,
    byte_start INTEGER NOT NULL CHECK(byte_start >= 0), byte_end INTEGER NOT NULL CHECK(byte_end > byte_start),
    FOREIGN KEY(artifact_id, task_id) REFERENCES artifacts(id, task_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE UNIQUE INDEX profile_owner_key ON model_profiles(id, ai_connection_id);
  CREATE TABLE stage_runs (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    ai_connection_id TEXT NOT NULL REFERENCES ai_connections(id) ON DELETE RESTRICT,
    model_profile_id TEXT,
    stage TEXT NOT NULL CHECK(stage IN ('context_preparation', 'investigation')),
    status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    input_snapshot TEXT NOT NULL, error_json TEXT,
    created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT,
    FOREIGN KEY(model_profile_id, ai_connection_id) REFERENCES model_profiles(id, ai_connection_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE UNIQUE INDEX one_active_run_per_task ON stage_runs(task_id) WHERE status IN ('queued', 'running');
  CREATE UNIQUE INDEX one_active_investigation ON stage_runs(stage) WHERE stage = 'investigation' AND status IN ('queued', 'running');
  CREATE TRIGGER run_owner_check BEFORE INSERT ON stage_runs
    WHEN NOT EXISTS (SELECT 1 FROM tasks t JOIN workspaces w ON w.id = t.workspace_id
      WHERE t.id = NEW.task_id AND w.ai_connection_id = NEW.ai_connection_id)
    BEGIN SELECT RAISE(ABORT, 'run_connection_mismatch'); END;
  CREATE TRIGGER run_input_immutable BEFORE UPDATE OF task_id, ai_connection_id, model_profile_id, stage, input_snapshot, created_at ON stage_runs
    BEGIN SELECT RAISE(ABORT, 'run_input_immutable'); END;
  CREATE TRIGGER run_terminal_immutable BEFORE UPDATE ON stage_runs
    WHEN OLD.status IN ('succeeded', 'failed', 'cancelled')
    BEGIN SELECT RAISE(ABORT, 'run_terminal_immutable'); END;
`;
