// Relocate the unchanged ordinary browser collector, varying only its initial page.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { hash, save } from '../loredock-prepared-flow/io.mjs';

export async function browserAdapter(directory) {
  const input = new URL('../loredock-prepared-flow/browser.mjs', import.meta.url);
  const original = await readFile(input, 'utf8'); let source = original;
  const edits = [
    ["browser({ directory, executable = '/usr/bin/google-chrome' })", "browser({ directory, executable = '/usr/bin/google-chrome', blank = false })"],
    ["{ url: 'http://127.0.0.1:4244' }", "{ url: blank ? 'about:blank' : 'http://127.0.0.1:4244' }"],
    ['evaluate("document.body.innerText.includes(\'Experimental prepared context\')")',
      'evaluate(blank ? "location.href===\'about:blank\'&&document.readyState===\'complete\'&&!!window.preparedFlowObservation" : "document.body.innerText.includes(\'Experimental prepared context\')")'],
  ];
  for (const [before, after] of edits) { assert.equal(source.split(before).length, 2); source = source.replace(before, after); }
  for (const name of ['io', 'ownership', 'process-tree', 'browser-evidence']) {
    const before = "'./" + name + ".mjs'", after = JSON.stringify(new URL('../loredock-prepared-flow/' + name + '.mjs', import.meta.url).href);
    assert(source.includes(before)); source = source.replaceAll(before, after);
  }
  const output = pathToFileURL(directory + '/browser-adapter.mjs');
  await writeFile(output, source, { flag: 'wx' });
  await save(directory + '/browser-adapter.json', { source: input.href, beforeSha256: hash(original), afterSha256: hash(source), edits,
    importRelocationOnly: ['io', 'ownership', 'process-tree', 'browser-evidence'],
    rawRssSamplerChanged: false, browserFlagsChanged: false, resourceQualification: false });
  return (await import(output.href)).browser;
}
