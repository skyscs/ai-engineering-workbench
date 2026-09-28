export const draftSchema = `
  CREATE TABLE investigation_drafts (
    id TEXT PRIMARY KEY, input_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    task_id TEXT UNIQUE REFERENCES tasks(id) ON DELETE RESTRICT,
    preserve_context INTEGER NOT NULL DEFAULT 0 CHECK(preserve_context IN (0,1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE draft_files (
    id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES investigation_drafts(id) ON DELETE CASCADE,
    name TEXT NOT NULL, bytes BLOB NOT NULL, included INTEGER NOT NULL DEFAULT 1 CHECK(included IN (0,1))
  ) STRICT;
  CREATE TABLE investigation_launches (
    id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES investigation_drafts(id) ON DELETE RESTRICT,
    input_json TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('checking','repositories','preparing','investigating','succeeded','failed','cancelled')),
    message TEXT NOT NULL, error_json TEXT, run_id TEXT REFERENCES stage_runs(id) ON DELETE RESTRICT,
    cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX one_active_launch ON investigation_launches((1))
    WHERE state IN ('checking','repositories','preparing','investigating');
`;
