import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('browser attribution reads real argv and collapsed Chrome titles without interpreting unrelated path text', () => {
  const executable = '/opt/google/chrome/chrome';
  const rows = [
    { executable, argv: [executable, '--type=renderer'] },
    { executable, argv: [executable + ' --type=utility --utility-sub-type=network.mojom.NetworkService --no-sandbox'] },
    { executable, argv: [executable, '--user-data-dir=/tmp/profile --type=renderer'] },
    { executable: '/usr/bin/python3.14', argv: ['python3 --type=renderer'] },
    { executable, argv: [executable + ' --type=renderer --type=utility'] },
  ];
  const program = `import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('assessment',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
result=[]
for row in json.load(sys.stdin):
    try: result.append(module.role(row))
    except AssertionError: result.append('ambiguous-rejected')
print(json.dumps(result))`;
  const output = execFileSync('python3', ['-I', '-S', '-B', '-c', program,
    fileURLToPath(new URL('../loredock-browser-memory/assess.py', import.meta.url))], { input: JSON.stringify(rows), encoding: 'utf8', timeout: 10000 });
  assert.deepEqual(JSON.parse(output), ['renderer', 'utility:network.mojom.NetworkService',
    'browser-root', 'lifetime-collector', 'ambiguous-rejected']);
});
