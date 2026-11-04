import { services as compact } from '../loredock-compact-payloads/services.mjs';
import { createPreparedReads } from './reuse.mjs';

export const services = { ...compact, ...createPreparedReads(compact) };
