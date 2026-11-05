// Independent ordinary browser/process observation. No reserved-family imports or models.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';
import { browser } from './browser.mjs';

const output = process.argv[2]; assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output); const report = { schemaVersion: 'prepared-flow-browser-development/1', errors: [], modelCalls: 0, reservedFamilyReads: 0 };
let daemon, api, page;
try {
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'daemon'), data: path.join(output, 'data'), controlled: true });
  assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  api = await client(path.join(output, 'http')); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  const input = await prepare(api, question); await generate(api, input.review);
  page = await browser({ directory: path.join(output, 'browser') }); await page.prepare(question);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.evaluate("document.querySelector('.answer-panel').scrollIntoView()");
  const desktop = await page.snapshot('desktop'); assert(!desktop.overflow); assert(desktop.text.includes('Saved prepared context'));
  await page.protocol.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  const mobile = await page.snapshot('mobile'); assert(!mobile.overflow);
  report.controlled = await daemon.command('stats'); assert.equal(report.controlled.calls, 1);
  report.browser = await page.stop(); page = undefined; assert.deepEqual(report.browser.errors, []); assert.equal(report.browser.sampleError, null);
  assert.equal(report.browser.code, 0); assert.equal(report.browser.signal, null);
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { if (page) report.browser = await page.stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  api?.close();
  try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true })); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
