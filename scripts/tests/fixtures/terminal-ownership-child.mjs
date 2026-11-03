import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createTerminalExporter } from '../../loredock-terminal-ownership/export.mjs';

const [root, mode = 'snapshots', cap = '134217728'] = process.argv.slice(2);
if (mode === 'fail') { process.stderr.write('Independent child failure.\n'); process.exitCode = 7; }
else if (mode === 'cleanup') { process.stderr.write('Independent cleanup failure.\n'); process.exitCode = 8; }
else if (mode === 'hang') setInterval(() => {}, 1000);
else if (mode === 'oversize') writeFileSync(path.join(root, 'oversized.bin'), Buffer.alloc(2 * 1024 * 1024));
else {
  class TerminalOwnedFixture { constructor() { this.tag = 'terminal-owned-fixture/1'; this.payload = new Array(4096).fill('owned'); } }
  const exportStage = await createTerminalExporter(root, { fileBytes: Number(cap) });
  await assert.rejects(exportStage('after-release'));
  async function ownUntilHistory() {
    globalThis.terminalFixture = new TerminalOwnedFixture();
    await exportStage('after-history');
    delete globalThis.terminalFixture;
  }
  await ownUntilHistory(); await nextTurn();
  await exportStage('after-release');
  await assert.rejects(exportStage());
  await assert.rejects(exportStage('after-release'));
}
