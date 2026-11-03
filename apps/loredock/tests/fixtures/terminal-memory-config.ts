import { configuration as base } from './streaming-qualification-config.js';

// Independent tiny full-application integration only, never frozen diagnostic inputs.
export async function configuration(size: number) {
  const config = await base(0);
  if (![0, 1].includes(size)) throw new Error('Unknown terminal integration variant.');
  let stores = 0;
  class CleanupFailureStore extends config.services.CatalogStore {
    private readonly failClose = ++stores === 2;
    override close() {
      super.close();
      if (this.failClose) throw new Error('Deliberate terminal cleanup failure.');
    }
  }
  return { ...config, services: size === 1 ? { ...config.services, CatalogStore: CleanupFailureStore } : config.services,
    oracle: { ...config.oracle, arms: ['same-process'] }, terminalLimits: { watchdogMs: 30000 } };
}
