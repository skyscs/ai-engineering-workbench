import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { hash, save } from '../loredock-prepared-flow/io.mjs';

export function adapt(original, base) {
  assert.equal(hash(original), '1dea3e4279a7f35eb7e829c44aaf5198eb453e17b9f8a3f85fba9c18276bfc4a');
  const edits = [
    ["browser({ directory, executable = '/usr/bin/google-chrome' })", "browser({ directory, executable = '/usr/bin/google-chrome', blank = false })"],
    ["{ url: 'http://127.0.0.1:4244' }", "{ url: blank ? 'about:blank' : 'http://127.0.0.1:4244' }"],
    ['evaluate("document.body.innerText.includes(\'Experimental prepared context\')")',
      'evaluate(blank ? "location.href===\'about:blank\'&&document.readyState===\'complete\'&&!!window.preparedFlowObservation" : "document.body.innerText.includes(\'Experimental prepared context\')")'],
    ['memoryTimer = setInterval(() => { void sample(); }, 100)', 'memoryTimer = setInterval(() => { void sample(); }, 50)'],
  ];
  let source = original;
  for (const [before, after] of edits) { assert.equal(source.split(before).length, 2); source = source.replace(before, after); }
  for (const name of ['io', 'ownership', 'process-tree', 'browser-evidence']) {
    const before = "'./" + name + ".mjs'", after = JSON.stringify(new URL(name + '.mjs', base).href);
    assert(source.includes(before)); source = source.replaceAll(before, after);
  }
  return { source, record: { beforeSha256: hash(original), afterSha256: hash(source), edits,
    importRelocationOnly: ['io', 'ownership', 'process-tree', 'browser-evidence'], nominalCadenceMs: 50,
    actualMaximumGapMs: 100, browserFlagsChanged: false, rssAccountingChanged: false, resourceQualification: false } };
}

export async function browserAdapter(directory) {
  const input = new URL('../loredock-prepared-flow/browser.mjs', import.meta.url);
  const { source, record } = adapt(await readFile(input, 'utf8'), new URL('./', input));
  const output = pathToFileURL(directory + '/browser-adapter.mjs');
  await writeFile(output, source, { flag: 'wx' }); await save(directory + '/browser-adapter.json', record);
  return (await import(output.href)).browser;
}
