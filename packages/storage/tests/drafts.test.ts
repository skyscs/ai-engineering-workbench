import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { openStorage } from '../src/index.js';

function fixture(t: TestContext, limit = 1024) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-drafts-'));
  const storage = openStorage({ dataRoot: root, artifactLimits: { contextBytes: limit } });
  t.after(() => { storage.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, storage, drafts: storage.drafts };
}
test('drafts preserve UTF-8 bytes, selections and revisions across restart without locking a connection', t => {
  const f = fixture(t), id = randomUUID(), file = randomUUID();
  const workspace = f.storage.settings.createWorkspace({ name: 'Draft', connection: { name: 'Fixture', configHome: f.root } });
  const initial = f.drafts.create(id);
  assert.deepEqual(f.drafts.create(id), initial);
  const saved = f.drafts.save(id, 0, { ...initial.input, workspaceId: workspace.workspace.id, source: '/source', description: 'Explain café.' });
  assert.throws(() => f.drafts.save(id, undefined as unknown as number, saved.input), { code: 'INVALID_INPUT' });
  assert.throws(() => f.drafts.save(id, 0, saved.input), { code: 'CONFLICT' });
  const uploaded = f.drafts.putFile(id, file, 'trace.log', Buffer.from('café\n'));
  assert.deepEqual(f.drafts.putFile(id, file, 'trace.log', Buffer.from('café\n')), uploaded);
  assert.throws(() => f.drafts.putFile(id, file, 'trace.log', Buffer.from('different')), { code: 'CONFLICT' });
  f.drafts.changeFile(id, file, false);
  assert.equal(f.storage.settings.getWorkspace(workspace.workspace.id).workspace.boundaryLocked, false);
  f.storage.close();
  const reopened = openStorage({ dataRoot: f.root });
  try {
    const result = reopened.drafts.get(id);
    assert.equal(result.input.description, 'Explain café.'); assert.equal(result.files[0]!.included, false);
    assert.equal(Buffer.from(reopened.drafts.fileBytes(id, file)).toString(), 'café\n');
    const copied = reopened.drafts.copy(id, randomUUID());
    assert.deepEqual(copied.input, result.input); assert.notEqual(copied.files[0]!.id, file); assert.equal(copied.taskId, null);
    reopened.drafts.discard(id); assert.throws(() => reopened.drafts.get(id), { code: 'NOT_FOUND' });
    assert.equal(copied.files.length, 1);
  } finally { reopened.close(); }
});
test('bounded drafts reject binary, unsupported types, traversal and oversized text without losing saved content', t => {
  const { drafts } = fixture(t, 12), draft = drafts.create(randomUUID());
  drafts.save(draft.id, 0, { ...draft.input, description: 'café' });
  for (const [name, text] of [['trace.png', Buffer.from('text')], ['../trace.log', Buffer.from('text')], ['trace.log', Buffer.from([255])], ['trace.log', Buffer.from('binary\0')], ['trace.log', Buffer.from('12345678')]] as const) {
    assert.throws(() => drafts.putFile(draft.id, randomUUID(), name, text), { code: 'INVALID_INPUT' });
  }
  assert.equal(drafts.get(draft.id).files.length, 0); assert.equal(drafts.get(draft.id).input.description, 'café');
});
test('launch claims are idempotent, globally exclusive, immutable while active and interrupted without automatic retry', t => {
  const f = fixture(t), draft = f.drafts.create(randomUUID());
  const saved = f.drafts.save(draft.id, 0, { ...draft.input, description: 'Explain.', workspaceId: randomUUID(), source: '/source' });
  const id = randomUUID(), claim = f.drafts.claim(draft.id, id, saved.revision);
  assert.equal(claim.created, true); assert.equal(f.drafts.claim(draft.id, id, -1).created, false);
  assert.throws(() => f.drafts.claim(draft.id, randomUUID(), saved.revision), { code: 'CONFLICT' });
  assert.throws(() => f.drafts.save(draft.id, saved.revision, saved.input), { code: 'CONFLICT' });
  assert.throws(() => f.drafts.discard(draft.id), { code: 'CONFLICT' });
  f.storage.close(); const reopened = openStorage({ dataRoot: f.root });
  try {
    assert.equal(reopened.drafts.get(draft.id).launch!.state, 'failed');
    assert.equal(reopened.drafts.claim(draft.id, id, saved.revision).created, false);
    assert.equal(reopened.drafts.claim(draft.id, randomUUID(), saved.revision).created, true);
  } finally { reopened.close(); }
});
