export const connectionHomeSchema = `
  ALTER TABLE ai_connections ADD COLUMN config_home TEXT;
  CREATE TRIGGER connection_home_boundary_frozen BEFORE UPDATE OF config_home ON ai_connections
    WHEN NEW.config_home IS NOT OLD.config_home
      AND EXISTS (SELECT 1 FROM workspaces WHERE ai_connection_id = OLD.id AND boundary_locked = 1)
      AND (OLD.config_home IS NOT NULL OR EXISTS (
        SELECT 1 FROM stage_runs WHERE ai_connection_id = OLD.id
          AND (stage = 'investigation' OR status IN ('queued', 'running'))))
    BEGIN SELECT RAISE(ABORT, 'workspace_boundary_locked'); END;
`;
