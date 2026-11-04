import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { openNativeState } from '../loredock-native-qualification/state.mjs';
import { prepareSources, dataHashes } from '../loredock-capture-memory/fixture.mjs';
import { services as actualServices } from '../loredock-native-qualification/services.mjs';

export async function prepareState(root, corpus, { services = actualServices, analyze = true } = {}) {
  await mkdir(root); const state = openNativeState(path.join(root, 'data'), services);
  try {
    const revisions = await prepareSources(root, corpus, state), current = state.catalog.state();
    const buildId = state.catalog.start('question-initial', current.sourceSetVersion, current.policyVersion).id; await state.catalog.idle();
    let inventoryId = null;
    if (analyze) { inventoryId = state.analysis.start('question-facts', buildId).id; await state.analysis.idle(); }
    return { state, root, buildId, inventoryId, revisions };
  } catch (error) { await state.close(); throw error; }
}
export async function closePrepared(prepared) {
  await prepared.state.close(); return { sourceHashes: await dataHashes(path.join(prepared.root, 'sources')), dataHashes: await dataHashes(path.join(prepared.root, 'data')) };
}
