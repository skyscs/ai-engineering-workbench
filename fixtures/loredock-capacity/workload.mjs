export const capacityWorkload = {
  schemaVersion: 'loredock-capacity-workload/1', sourceCount: 20,
  filesPerSource: 180, fileBytes: 2048, directory: 'load', probeSources: [0, 10, 19],
  scope: 'Deterministic source-volume stress, not representative framework complexity or semantic acceptance.',
};

export function capacityFile(sourceIndex, fileIndex) {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= capacityWorkload.sourceCount
    || !Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= capacityWorkload.filesPerSource) throw new Error('Invalid owned workload coordinates.');
  const source = String(sourceIndex).padStart(2, '0'), file = String(fileIndex).padStart(4, '0');
  const symbol = `loadProbe${source}${file}`;
  let text = `export function ${symbol}() {\n`;
  for (let cell = 0; cell < 20; cell++) text += `  const cell${cell} = 'zz${source}${file}${String(cell).padStart(2, '0')}';\n`;
  text += '  return cell0;\n}\n';
  text += '// ' + 'x'.repeat(capacityWorkload.fileBytes - Buffer.byteLength(text) - 4) + '\n';
  return { path: `${capacityWorkload.directory}/probe-${file}.ts`, symbol, text };
}
