import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function git(cwd, args) {
  return execFileSync('git', ['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Workbench Fixture','-c','user.email=fixture@example.invalid',...args], {cwd,encoding:'utf8',stdio:'pipe'}).trim();
}
async function repository(root, name, versions) {
  const source = path.join(root,name); await mkdir(source); git(source,['init','-b','main']);
  const commits = [];
  for (const [message, files] of versions) {
    for (const [filename, text] of Object.entries(files)) await writeFile(path.join(source,filename),text);
    git(source,['add','.']); git(source,['commit','-m',message]); commits.push({message,sha:git(source,['rev-parse','HEAD'])});
  }
  return { name, source, commits, files: git(source,['ls-files']).split('\n') };
}
export async function createReleaseFixture(kind) {
  if (!['single','interaction','revision'].includes(kind)) throw new Error('Choose single, interaction or revision.');
  const root = await mkdtemp(path.join(tmpdir(),`aew-release-${kind}-`));
  let repositories, description, log, expected, challenge = null, constraint = null;
  if (kind === 'single') {
    const initial = 'export function discountedTotal(cents, percent) {\n  return Math.round(cents * (100 - percent) / 100);\n}\n';
    const broken = 'export function discountedTotal(cents, percent) {\n  return Math.round(cents / 100) * (100 - percent);\n}\n';
    repositories = [await repository(root,'checkout',[
      ['feat: calculate discounts with final rounding',{'price.mjs':initial,'README.md':'Checkout totals are integer cents. Round once after applying the percentage.\n'}],
      ['refactor: normalize the price before applying discounts',{'price.mjs':broken}],
      ['docs: record checkout audit fields',{'audit.md':'Audit fields are totalCents and discountPercent; both are numeric.\n'}]
    ])];
    description = 'Investigate why a 1999-cent item with a 15% discount now charges 1700 cents instead of 1699. Inspect source and Git history; distinguish the introducing change from later documentation. Use the incident log. Do not implement a fix.';
    log = 'Input: cents=1999 percent=15\nExpected totalCents=1699\nObserved totalCents=1700\nQuantity=1; tax=0; no currency conversion.\n';
    expected = 'The normalization refactor rounds cents/100 before discount multiplication. Earlier code rounds the final discounted cents. Cite both versions of price.mjs and the incident; the audit-only commit is not causal.';
  } else if (kind === 'interaction') {
    repositories = [await repository(root,'client',[
      ['feat: consume retry interval in milliseconds',{'retry.mjs':'export function retryOptions(config) {\n  return { delayMs: config.retryDelay };\n}\n','README.md':'The scheduler consumes delayMs as milliseconds.\n'}],
      ['docs: describe exponential retries',{'retries.md':'Each subsequent retry doubles delayMs. The first retry uses the configured delay.\n'}]
    ]),await repository(root,'settings',[
      ['feat: publish retry interval in milliseconds',{'config.mjs':'export const config = { retryDelay: 2000, retryUnit: "milliseconds" };\n'}],
      ['refactor: publish retry intervals in seconds',{'config.mjs':'export const config = { retryDelay: 2, retryUnit: "seconds" };\n'}]
    ])];
    description = 'Investigate the retry storm after deploying the settings service. First retries occur after 2ms instead of 2000ms. Inspect both repositories and their histories, use the incident log, and identify the cross-repository contract boundary. Do not implement a fix.';
    log = 'Before settings deployment: retryDelay=2000 retryUnit=milliseconds delayMs=2000\nAfter settings deployment: retryDelay=2 retryUnit=seconds delayMs=2\nClient revision and scheduler package were unchanged.\n';
    expected = 'The settings producer changed milliseconds to seconds while the client still passes the numeric value directly as milliseconds. Cite the producer transition, unchanged consumer and incident; the retry-documentation commit is not causal.';
  } else {
    repositories = [await repository(root,'catalog',[
      ['feat: cache product titles per tenant',{'cache.mjs':'const cache = new Map();\nexport function title(tenant, sku, load) {\n  const key = `${tenant}:${sku}`;\n  if (!cache.has(key)) cache.set(key, load(tenant, sku));\n  return cache.get(key);\n}\n','view.mjs':'export function display(value, uppercase) {\n  return uppercase ? value.toUpperCase() : value;\n}\n','README.md':'Tenants may use the same SKU for different titles. Cached titles should never cross tenants. Uppercase display is an independent runtime flag.\n'}],
      ['refactor: share product cache keys across callers',{'cache.mjs':'const cache = new Map();\nexport function title(tenant, sku, load) {\n  const key = sku;\n  if (!cache.has(key)) cache.set(key, load(tenant, sku));\n  return cache.get(key);\n}\n'}],
      ['refactor: make title display flag explicit',{'view.mjs':'export function display(value, uppercase = false) {\n  return uppercase ? value.toUpperCase() : value;\n}\n'}]
    ])];
    description = 'Support reports an incorrect product title after a rollout. They suspect the recent display refactor, but provided no affected tenant, SKU, flag values or request sequence. Investigate the available history, distinguish demonstrable code defects from the unverified cause of this incident, and record what evidence is missing. Do not claim an incident cause without the missing observations. Do not implement a fix.';
    log = 'Incident observations added after the initial investigation:\nProcess restarted before this sequence; uppercase=false on both requests.\nRequest 1: tenant=alpha sku=42 databaseTitle=Alpha kettle returnedTitle=Alpha kettle\nRequest 2: tenant=beta sku=42 databaseTitle=Beta lamp returnedTitle=Alpha kettle\nDirect database lookup for beta/42 returned Beta lamp. Cache hits=1 on request 2.\n';
    expected = 'Initially distinguish plausible defects from unverified incident causality. After challenge, the shared SKU-only cache key explains cross-tenant reuse; the display flag was false and the database was correct. Cite the key-changing commit, previous tenant-scoped key and new incident artifact. Explain how new observations resolve the earlier uncertainty.';
    constraint = 'Preserve tenant isolation. Compare the tenant-scoped cache history and incident observations before accepting the display-refactor hypothesis. Do not implement changes.';
    challenge = 'The initial report lacked the affected request sequence. I added the incident log: beta receives alpha\'s title for the same SKU, with uppercase disabled and a correct database value. Reassess the incident cause against the exact earlier report and explain which uncertainty is now resolved.';
  }
  const artifact = path.join(root,'incident.log'); await writeFile(artifact,log);
  const fixture = {kind,root,repositories,artifact,description,expected,challenge,constraint};
  await writeFile(path.join(root,'manifest.json'),JSON.stringify(fixture,null,2));
  await writeFile(path.join(root,'baseline.json'),JSON.stringify(await releaseSnapshot(fixture),null,2));
  return fixture;
}
export async function releaseSnapshot(fixture) {
  const repositories = [];
  for (const r of fixture.repositories) {
    const hashes = {};
    for (const filename of r.files) hashes[filename] = createHash('sha256').update(await readFile(path.join(r.source,filename))).digest('hex');
    repositories.push({name:r.name,head:git(r.source,['rev-parse','HEAD']),status:git(r.source,['status','--porcelain']),hashes});
  }
  return {repositories,artifactHash:createHash('sha256').update(await readFile(fixture.artifact)).digest('hex')};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(await createReleaseFixture(process.argv[2]),null,2));
