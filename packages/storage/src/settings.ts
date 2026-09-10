import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { assertBoundaryEditable, DomainError, parseConnection, parseModelProfile,
  parseWorkspaceCreate, parseWorkspaceRename, type AIConnection, type Workspace, type ModelProfile } from '@aew/core';
import type { WorkspaceDetail } from '@aew/shared';

export interface SettingsRepository {
  listWorkspaces(): Workspace[];
  createWorkspace(input: unknown): WorkspaceDetail;
  getWorkspace(id: string): WorkspaceDetail;
  renameWorkspace(id: string, input: unknown): Workspace;
  deleteWorkspace(id: string): void;
  updateConnection(workspaceId: string, input: unknown): AIConnection;
  createModelProfile(workspaceId: string, input: unknown): ModelProfile;
  getModelProfile(workspaceId: string, profileId: string): ModelProfile;
  updateModelProfile(workspaceId: string, profileId: string, input: unknown): ModelProfile;
  deleteModelProfile(workspaceId: string, profileId: string): void;
  /** Task 006 must call this inside the transaction that creates the first task. */
  lockWorkspaceBoundary(id: string): void;
}

const workspaceColumns = `id, name, ai_connection_id AS aiConnectionId,
  boundary_locked AS boundaryLocked, created_at AS createdAt, updated_at AS updatedAt`;
const connectionColumns = `id, name, runtime_type AS runtimeType, executable_path AS executablePath,
  config_profile AS configProfile, created_at AS createdAt, updated_at AS updatedAt`;
const profileColumns = `id, ai_connection_id AS aiConnectionId, name, model_identifier AS modelIdentifier,
  reasoning_effort AS reasoningEffort, created_at AS createdAt, updated_at AS updatedAt`;

function executable(value: string | null): void {
  if (value !== null && !path.isAbsolute(value)) {
    throw new DomainError('INVALID_INPUT', 'executablePath must be an absolute path or null for the CLI on PATH.');
  }
}

export function createSettingsRepository(db: DatabaseSync, ensureOpen: () => void): SettingsRepository {
  function workspace(id: string): Workspace {
    ensureOpen();
    const row = db.prepare(`SELECT ${workspaceColumns} FROM workspaces WHERE id = ?`).get(id);
    if (!row) throw new DomainError('NOT_FOUND', 'Workspace not found.');
    return { ...row, boundaryLocked: row.boundaryLocked === 1 } as unknown as Workspace;
  }
  function connection(workspaceId: string): AIConnection {
    const owner = workspace(workspaceId);
    const row = db.prepare(`SELECT ${connectionColumns} FROM ai_connections WHERE id = ?`).get(owner.aiConnectionId);
    return { ...row, verificationStatus: 'not_verified' } as AIConnection;
  }
  function profile(workspaceId: string, profileId: string): ModelProfile {
    const owner = workspace(workspaceId);
    const row = db.prepare(`SELECT ${profileColumns} FROM model_profiles WHERE id = ? AND ai_connection_id = ?`)
      .get(profileId, owner.aiConnectionId);
    if (!row) throw new DomainError('NOT_FOUND', 'Model profile not found in this workspace.');
    return row as unknown as ModelProfile;
  }
  function detail(id: string): WorkspaceDetail {
    const owner = workspace(id);
    return { workspace: owner, connection: connection(id), modelProfiles:
      db.prepare(`SELECT ${profileColumns} FROM model_profiles WHERE ai_connection_id = ? ORDER BY created_at, id`)
        .all(owner.aiConnectionId) as unknown as ModelProfile[] };
  }
  function transaction<T>(run: () => T): T {
    ensureOpen();
    db.exec('BEGIN IMMEDIATE');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (error) {
      try { db.exec('ROLLBACK'); } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Settings transaction failed.');
      }
      throw error;
    }
  }
  return {
    listWorkspaces() {
      ensureOpen();
      return db.prepare(`SELECT ${workspaceColumns} FROM workspaces ORDER BY created_at, id`).all()
        .map((row) => ({ ...row, boundaryLocked: row.boundaryLocked === 1 }) as unknown as Workspace);
    },
    createWorkspace(value) {
      const input = parseWorkspaceCreate(value);
      executable(input.connection.executablePath);
      return transaction(() => {
        const id = randomUUID(), connectionId = randomUUID(), now = new Date().toISOString();
        db.prepare(`INSERT INTO ai_connections (id, name, runtime_type, executable_path, config_profile, created_at, updated_at)
          VALUES (?, ?, 'codex-cli', ?, ?, ?, ?)`).run(connectionId, input.connection.name,
          input.connection.executablePath, input.connection.configProfile, now, now);
        db.prepare(`INSERT INTO workspaces (id, name, ai_connection_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
          .run(id, input.name, connectionId, now, now);
        return detail(id);
      });
    },
    getWorkspace: detail,
    renameWorkspace(id, value) {
      const input = parseWorkspaceRename(value);
      workspace(id);
      db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?').run(input.name, new Date().toISOString(), id);
      return workspace(id);
    },
    deleteWorkspace(id) {
      transaction(() => {
        const owner = workspace(id);
        assertBoundaryEditable(owner.boundaryLocked);
        db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
        db.prepare('DELETE FROM ai_connections WHERE id = ?').run(owner.aiConnectionId);
      });
    },
    updateConnection(id, value) {
      const input = parseConnection(value);
      executable(input.executablePath);
      const owner = workspace(id), previous = connection(id);
      if (input.executablePath !== previous.executablePath || input.configProfile !== previous.configProfile) {
        assertBoundaryEditable(owner.boundaryLocked);
      }
      db.prepare('UPDATE ai_connections SET name = ?, executable_path = ?, config_profile = ?, updated_at = ? WHERE id = ?')
        .run(input.name, input.executablePath, input.configProfile, new Date().toISOString(), owner.aiConnectionId);
      return connection(id);
    },
    createModelProfile(id, value) {
      const input = parseModelProfile(value), owner = workspace(id);
      const profileId = randomUUID(), now = new Date().toISOString();
      db.prepare(`INSERT INTO model_profiles (id, ai_connection_id, name, model_identifier, reasoning_effort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(profileId, owner.aiConnectionId, input.name, input.modelIdentifier, input.reasoningEffort, now, now);
      return profile(id, profileId);
    },
    getModelProfile: profile,
    updateModelProfile(id, profileId, value) {
      const input = parseModelProfile(value), previous = profile(id, profileId);
      db.prepare('UPDATE model_profiles SET name = ?, model_identifier = ?, reasoning_effort = ?, updated_at = ? WHERE id = ? AND ai_connection_id = ?')
        .run(input.name, input.modelIdentifier, input.reasoningEffort, new Date().toISOString(), profileId, previous.aiConnectionId);
      return profile(id, profileId);
    },
    deleteModelProfile(id, profileId) {
      const previous = profile(id, profileId);
      db.prepare('DELETE FROM model_profiles WHERE id = ? AND ai_connection_id = ?').run(profileId, previous.aiConnectionId);
    },
    lockWorkspaceBoundary(id) {
      workspace(id);
      db.prepare('UPDATE workspaces SET boundary_locked = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    }
  };
}
