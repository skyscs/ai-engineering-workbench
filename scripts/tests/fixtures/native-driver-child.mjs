import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { services as original } from '../../loredock-native-qualification/services.mjs';
import { runNativeWorker } from '../../loredock-native-qualification/run.mjs';
import { configuration } from '../../loredock-native-qualification/development.mjs';
const [root, arm, , mode] = process.argv.slice(2);
if (mode === '5') { console.error('Injected native child exit.'); process.exit(7); }
if (mode === '6') { process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); }
else {
  const services = { ...original }; let closures = 0;
  if (mode === '2') services.CatalogStore = class extends original.CatalogStore {
    close() { super.close(); closures++; if (closures === (arm === 'same-process' ? 2 : 1)) throw new Error('Injected closed-owner cleanup failure.'); }
  };
  const { report, exitCode } = await runNativeWorker({ root, arm, config: configuration(0), services });
  if (mode === '3') await writeFile(path.join(root, arm, 'result.json'), '{');
  if (mode === '4' && arm === 'same-process') await appendFile(path.join(root, 'reopened-process/data/loredock.db'), Buffer.from([0]));
  console.log(JSON.stringify({ arm, mode, operations: report.operations.length })); process.exitCode = exitCode;
}
