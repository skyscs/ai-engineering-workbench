// Fault lane only: hold the real response bytes at Chrome's network boundary, never replace fetch or product code.
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { sanitized } from './browser.mjs';
import { save, until, normalized } from './io.mjs';

export async function holdResponse(page, { pattern, directory, name }) {
  assert(/^[a-z0-9-]+$/.test(name));
  let held, captured, failed, released = false;
  const tasks = new Set();
  const remove = page.listen(message => {
    if (message.method !== 'Fetch.requestPaused') return;
    const task = (async () => {
      const row = message.params;
      if (held) { await page.protocol.send('Fetch.continueResponse', { requestId: row.requestId }); return; }
      assert(row.responseStatusCode, 'Expected a real response-stage interception.'); held = row;
      await save(path.join(directory, name + '-request.json'), sanitized(row));
      const response = await page.protocol.send('Fetch.getResponseBody', { requestId: row.requestId });
      const raw = response.base64Encoded ? Buffer.from(response.body, 'base64') : Buffer.from(response.body);
      assert(raw.length <= 2 * 1024 * 1024, 'Held response exceeds the evidence retention bound.');
      await writeFile(path.join(directory, name + '-response.json'), raw, { flag: 'wx' });
      captured = { request: JSON.parse(row.request.postData ?? 'null'), value: JSON.parse(raw.toString('utf8')), bytes: raw.length,
        status: row.responseStatusCode, heldAt: performance.now() };
    })().catch(error => { failed = error; }).finally(() => tasks.delete(task)); tasks.add(task);
  });
  try { await page.protocol.send('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Response' }] }); }
  catch (error) { remove(); throw error; }
  async function release(drop = false) {
    if (released || !held) return; released = true;
    await save(path.join(directory, name + '-release.json'), { action: drop ? 'drop-after-server-response' : 'continue-original-response',
      heldMs: captured ? performance.now() - captured.heldAt : null, captureError: failed ? normalized(failed) : null });
    await page.protocol.send(drop ? 'Fetch.failRequest' : 'Fetch.continueResponse', { requestId: held.requestId, ...drop ? { errorReason: 'Aborted' } : {} });
  }
  return {
    wait: () => until(() => { if (failed) throw failed; return captured; }, 'Expected HTTP response was not held.'), release,
    async close() { try { await Promise.allSettled([...tasks]); await release(); await page.protocol.send('Fetch.disable'); } finally { remove(); } }
  };
}
