import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { verifyRuntimeInputs } from './inputs.mjs';
import { assess } from '../loredock-browser-eligibility/assess.mjs';
import { browserAdapter } from './adapter.mjs';

const [output, mode, ...extra] = process.argv.slice(2);
assert.equal(output, '/evidence/owner/run'); assert.equal(mode, 'browser'); assert.equal(extra.length, 0);
assert.equal(process.versions.node, '22.23.2'); assert.deepEqual(process.execArgv, []);
assert(!process.env.NODE_OPTIONS); assert.equal(process.getuid(), 1000);
await mkdir(output); await mkdir(output + '/home'); await mkdir(output + '/tmp');
const manifest = JSON.parse(await readFile('/opt/workbench/control-inputs.json', 'utf8'));
const save = (name, value) => writeFile(output + '/' + name, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const report = { mode, nominalCadenceMs: 50, actualMaximumGapMs: 100, failure: null, assessment: null,
  lifecycle: null, browser: null, idle: null, inputsUnchanged: false, resourceQualification: false };
let page;
try {
  await save('input-verification.json', await verifyRuntimeInputs()); await save('input-manifest.json', manifest);
  const browser = await browserAdapter(output);
  report.lifecycle = { began: performance.now(), ended: null, timeOrigin: performance.timeOrigin, clock: 'driver performance.now()' };
  page = await browser({ directory: output + '/browser', executable: '/opt/chrome/chrome', blank: true });
  assert.equal(await page.evaluate('location.href'), 'about:blank');
  report.idle = await page.idleWindow('container-blank-browser', 30000);
  report.browser = await page.stop(); page = undefined; report.lifecycle.ended = performance.now();
  const samples = (await readFile(output + '/browser/process-tree.jsonl', 'utf8')).trim().split('\n').map(JSON.parse);
  report.assessment = { ...assess({ samples, browser: report.browser, idle: report.idle, lifetime: report.lifecycle }),
    nominalCadenceMs: 50, scope: 'One blank control in the pinned private container; no application or full-flow qualification.' };
} catch (error) { report.failure = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; }
finally {
  if (page) try { report.browser = await page.stop(); } catch (error) { report.failure ??= { message: error.message, stack: error.stack }; }
  if (report.lifecycle && report.lifecycle.ended === null) report.lifecycle.ended = performance.now();
  try { await save('input-verification-after.json', await verifyRuntimeInputs()); report.inputsUnchanged = true; } catch (error) { report.failure ??= { message: error.message, stack: error.stack }; }
  await save('result.json', report);
  if (report.failure || !report.assessment?.eligible || !report.inputsUnchanged) process.exitCode = 1;
}
