import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { plan } from './plan.mjs';
import { browserAdapter } from './adapter.mjs';
import { roles } from './roles.mjs';
import { launch, client, inventory, normalized, save, journal, until } from '../loredock-prepared-flow/io.mjs';

const [output, baseline, saved] = process.argv.slice(2);
assert.equal(process.argv.length, 5);
for (const file of [output, baseline, saved]) assert(path.isAbsolute(file ?? '') && path.resolve(file) === file);
await mkdir(output); await save(path.join(output, 'plan.json'), { ...plan, baseline, saved });
const before = [await inventory(baseline), await inventory(saved, { recordSymlinks: true })];
const input = JSON.parse(await readFile(path.join(baseline, 'run/inputs.json'), 'utf8'));
const savedResult = JSON.parse(await readFile(path.join(saved, 'run/result.json'), 'utf8'));
const admission = savedResult.cases.find(row => row.name === 'controlled-v2-save').value;
const browser = await browserAdapter(output), log = journal(path.join(output, 'sequence.jsonl'));
const result = { errors: [], cases: [], modelCalls: 0, resourceQualification: false };
for (const name of plan.order) {
  const directory = path.join(output, name); await mkdir(directory);
  const value = { name, errors: [] }; let daemon, api, page, diagnostic;
  log.append({ event: 'started', name, now: performance.now(), timeOrigin: performance.timeOrigin });
  try {
    if (name !== 'blank-browser') {
      const source = name === 'indexed-ui' ? path.join(baseline, 'run/production-data') : admission.checkpoint;
      const data = path.join(directory, 'data');
      await cp(source, data, { recursive: true, force: false, errorOnExist: true });
      assert.deepEqual(await inventory(source), await inventory(data));
      daemon = await launch({ directory: path.join(directory, 'daemon'), data });
      api = await client(path.join(directory, 'http'));
      const answers = await api.request('/answers');
      assert.equal(answers.value.attempts.length, name === 'indexed-ui' ? 0 : 1);
      if (name === 'ready-and-saved') assert.equal((await api.request('/answers/' + admission.published.answer.id)).rawSha256, admission.detail.rawSha256);
    }
    page = await browser({ directory: path.join(directory, 'browser'), blank: name === 'blank-browser' });
    diagnostic = roles(path.join(directory, 'browser')); await diagnostic.sample(); diagnostic.mark('initial-page-ready');
    if (name === 'blank-browser') assert.equal(await page.evaluate('location.href'), 'about:blank');
    if (name === 'indexed-ui') assert.equal(await page.evaluate("document.querySelectorAll('.question-context,.answer-result').length"), 0);
    if (name === 'ready-and-saved') {
      diagnostic.mark('preparation-start'); await page.prepare(input.expected.question);
      await until(() => page.evaluate("document.querySelectorAll('.native-question-context').length===2"), 'Ready and saved contexts are required.');
      const labels = await page.evaluate("[...document.querySelectorAll('.native-question-context')].map(element=>element.textContent)");
      assert(labels.every(text => text.includes('Related code context') && text.includes('Deployment coherence is unknown')));
      value.contextLabels = labels; diagnostic.mark('ready-and-saved-visible');
    }
    diagnostic.mark('idle-start'); value.idle = await page.idleWindow(name, plan.idleMs); diagnostic.mark('idle-end');
    value.diagnostic = await diagnostic.stop(); diagnostic = undefined; assert.deepEqual(value.diagnostic.errors, []);
    value.browser = await page.stop(); page = undefined;
    assert.equal(value.browser.code, 0); assert.equal(value.browser.sampleError, null); assert.deepEqual(value.browser.errors, []);
    value.rawRssPass = value.browser.maxRssBytes <= plan.rssLimit;
    if (api) assert.equal((await api.request('/answers')).value.attempts.length, name === 'indexed-ui' ? 0 : 1);
  } catch (error) { value.errors.push(normalized(error)); }
  finally {
    for (const owned of [diagnostic, page]) try { await owned?.stop(); } catch (error) { value.errors.push(normalized(error)); }
    api?.close();
    try { if (daemon) { value.exit = await daemon.stop(); assert.equal(value.exit.code, 0); } }
    catch (error) { value.errors.push(normalized(error)); }
    result.cases.push(value); await save(path.join(directory, 'result.json'), value);
    log.append({ event: 'finished', name, errors: value.errors, now: performance.now(), timeOrigin: performance.timeOrigin });
  }
  if (value.errors.length) { result.errors.push(...value.errors); process.exitCode = 1; break; }
}
try {
  assert.deepEqual(await inventory(baseline), before[0]); assert.deepEqual(await inventory(saved, { recordSymlinks: true }), before[1]);
  result.retainedInputsUnchanged = true;
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
await save(path.join(output, 'result.json'), result); log.close();
console.log(JSON.stringify({ errors: result.errors, cases: result.cases.map(row => ({ name: row.name,
  maxRssBytes: row.browser?.maxRssBytes, rawRssPass: row.rawRssPass })), resourceQualification: false }, null, 2));
