import type { Catalog } from './catalog.js';

/** Both native derivation versions share one path read owner per catalog. */
export const activePathCatalogs = new WeakSet<Catalog>();
