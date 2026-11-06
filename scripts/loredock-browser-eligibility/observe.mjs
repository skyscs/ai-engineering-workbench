import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from './plan.mjs';
import { digestFile, verifyTree } from './verify.mjs';
import { assess } from './assess.mjs';

const [output, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0); assert.equal(output, plan.firstOutput + '/run');
assert.equal(process.versions.node, plan.node); assert.deepEqual(process.execArgv, []); assert(!process.env.NODE_OPTIONS);
await mkdir(output);
const save = (name, value) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const manifestHash = await digestFile(fileURLToPath(new URL('./manifest.json', import.meta.url)));
const failureRecord = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
const report = { plan, manifestHash, failure: null, assessment: null, lifecycle: null, browser: null,
  idle: null, diagnostic: null, inputsUnchanged: false, resourceQualification: false };
let page, diagnostic;
async function verifyInputs() {
  assert.equal(manifest.browser.version, plan.browserVersion);
  assert.equal(manifest.browser.archiveURL, plan.archiveURL);
  assert.equal(await digestFile(manifest.node.executable), manifest.node.sha256);
  assert.equal(path.resolve(process.execPath), manifest.node.executable);
  assert.equal(await digestFile(manifest.browser.archive), manifest.browser.archiveSha256);
  await verifyTree(path.dirname(manifest.browser.executable), manifest.installedFiles);
  for (const row of manifest.scripts) assert.equal(await digestFile(path.join(root, row.path)), row.sha256, row.path);
}
try {
  await verifyInputs(); await save('plan.json', { ...plan, manifestHash });
  const [{ browserAdapter }, { roles }] = await Promise.all([
    import('../loredock-browser-memory/adapter.mjs'), import('../loredock-browser-memory/roles.mjs'),
  ]);
  const browser = await browserAdapter(output);
  report.lifecycle = { began: performance.now(), ended: null, clock: 'driver performance.now()', timeOrigin: performance.timeOrigin };
  page = await browser({ directory: path.join(output, 'browser'), executable: manifest.browser.executable, blank: true });
  assert.equal(await page.evaluate('location.href'), 'about:blank');
  diagnostic = roles(path.join(output, 'browser')); await diagnostic.sample(); diagnostic.mark('blank-ready');
  diagnostic.mark('idle-start'); report.idle = await page.idleWindow('blank-browser', plan.idleMs); diagnostic.mark('idle-end');
  report.diagnostic = await diagnostic.stop(); diagnostic = undefined;
  report.browser = await page.stop(); page = undefined; report.lifecycle.ended = performance.now();
  const samples = (await readFile(path.join(output, 'browser/process-tree.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  report.assessment = assess({ samples, browser: report.browser, idle: report.idle, lifetime: report.lifecycle,
    diagnosticErrors: report.diagnostic.errors });
} catch (error) { report.failure = failureRecord(error); }
finally {
  if (diagnostic) try { report.diagnostic = await diagnostic.stop(); } catch (error) { report.failure ??= failureRecord(error); }
  if (page) try { report.browser = await page.stop(); } catch (error) { report.failure ??= failureRecord(error); }
  if (report.lifecycle && report.lifecycle.ended === null) report.lifecycle.ended = performance.now();
  try { await verifyInputs(); report.inputsUnchanged = true; } catch (error) { report.failure ??= failureRecord(error); }
  await save('result.json', report);
  console.log(JSON.stringify({ failure: report.failure, assessment: report.assessment, inputsUnchanged: report.inputsUnchanged }));
  if (report.failure || !report.assessment?.eligible || !report.inputsUnchanged) process.exitCode = 1;
}
