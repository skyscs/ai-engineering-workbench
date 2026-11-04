import { constants, openSync, writeFileSync, fsyncSync, closeSync, fstatSync, lstatSync, linkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { CatalogStore } from './store.js';
import { OperationBudget } from './operation-budget.js';
import { decodeNativeReceipt } from './native-receipt.js';
import { hex, requireReceipt, uuid } from './native-receipt-json.js';
import { ReceiptLayout, readBounded, storageHook, storageLimits, missing, NativeStorageCleanupError, type NativeStorageOptions } from './native-receipt-files.js';

/** Owned by CatalogStore. These internal byte operations do not authorize source text. */
export class NativeReceiptStore {
  private readonly layout: ReceiptLayout;
  private readonly limits: ReturnType<typeof storageLimits>;
  private closed = false; private disabled = false; private busy = false;
  constructor(store: CatalogStore, readonly catalogId: string, private readonly options: NativeStorageOptions = {}) {
    this.limits = storageLimits(options); this.layout = new ReceiptLayout(store.directory, catalogId, options, this.limits);
    const names = this.layout.inspect(true);
    // Validate completed history before touching recognized incomplete work.
    for (const name of names) if (name !== '.pending') this.maintenanceRead(name);
    if (names.includes('.pending')) { this.remove('.pending'); this.layout.sync(); }
  }
  private check() { requireReceipt(!this.closed, 'CLOSED_RECEIPT_STORAGE'); requireReceipt(!this.disabled, 'DISABLED_RECEIPT_STORAGE'); }
  private enter() { this.check(); requireReceipt(!this.busy, 'RECEIPT_STORAGE_BUSY'); this.busy = true; }
  private readFile(name: string, budget: OperationBudget) {
    budget.check(); const raw = readBounded(path.join(this.layout.root, name), this.limits.bytes, this.options);
    const decoded = decodeNativeReceipt(raw, this.catalogId, budget, { receiptBytes: this.limits.bytes });
    requireReceipt(name === decoded.receipt.receiptHash + '.json'); budget.check(); return decoded;
  }
  private maintenanceRead(name: string) {
    // Startup/purge validates at most 64 separate bounded records; it is not a
    // capture/history operation and does not borrow or reset a caller budget.
    const budget = new OperationBudget(); try { return this.readFile(name, budget); } finally { budget.close(); }
  }
  private remove(name: string, expected?: { dev: number; ino: number }) {
    storageHook(this.options, 'before-unlink', name); this.layout.inspect(true);
    if (expected) { const stat = lstatSync(path.join(this.layout.root, name));
      requireReceipt(stat.isFile() && stat.dev === expected.dev && stat.ino === expected.ino, 'RECEIPT_FILE_CHANGED'); }
    unlinkSync(path.join(this.layout.root, name));
  }
  read(id: string, budget: OperationBudget) {
    this.enter(); try {
      requireReceipt(budget instanceof OperationBudget, 'INVALID_CAPTURE_BUDGET'); requireReceipt(hex(id), 'INVALID_RECEIPT_ID');
      budget.check(); const names = this.layout.inspect(); budget.charge('receipt', names.length);
      requireReceipt(names.includes(id + '.json'), 'RECEIPT_NOT_FOUND'); return this.readFile(id + '.json', budget);
    } finally { this.busy = false; }
  }
  publish(input: Uint8Array, budget: OperationBudget, guard: () => unknown) {
    this.enter(); let pending = false, created = false, fd: number | undefined, name = '', owned: { dev: number; ino: number } | undefined;
    const check = () => { this.check(); requireReceipt(budget instanceof OperationBudget, 'INVALID_CAPTURE_BUDGET');
      budget.check(); requireReceipt(typeof guard === 'function', 'INVALID_RECEIPT_GUARD');
      const result = guard(); requireReceipt(!(result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result && result.then), 'INVALID_RECEIPT_GUARD');
      this.check(); budget.check(); };
    try {
      check(); const decoded = decodeNativeReceipt(input, this.catalogId, budget, { receiptBytes: this.limits.bytes }); name = decoded.receipt.receiptHash + '.json';
      const size = Buffer.byteLength(decoded.serialized);
      const names = this.layout.inspect(); budget.charge('receipt', names.length); check();
      if (names.includes(name)) {
        requireReceipt(this.readFile(name, budget).serialized === decoded.serialized); check();
        return { receiptHash: decoded.receipt.receiptHash, created: false, bytes: size };
      }
      requireReceipt(names.length < this.limits.records, 'CAPTURE_STORAGE_FULL'); this.layout.create(); check();
      fd = openSync(path.join(this.layout.root, '.pending'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); pending = true;
      owned = fstatSync(fd);
      writeFileSync(fd, decoded.serialized); fsyncSync(fd); closeSync(fd); fd = undefined;
      storageHook(this.options, 'pending-written', name); check(); this.layout.inspect(true);
      try { linkSync(path.join(this.layout.root, '.pending'), path.join(this.layout.root, name)); created = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        requireReceipt(this.readFile(name, budget).serialized === decoded.serialized); }
      storageHook(this.options, 'linked', name); check(); this.layout.inspect(true);
      this.remove('.pending', owned); pending = false; this.layout.sync(); check();
      return { receiptHash: decoded.receipt.receiptHash, created, bytes: size };
    } catch (error) {
      try {
        if (fd !== undefined) { closeSync(fd); fd = undefined; }
        if (pending) { try { this.remove('.pending', owned); } catch (failure) { if (!missing(failure)) throw failure; } }
        if (created) this.remove(name, owned);
        if (pending || created) this.layout.sync();
      } catch (cleanupError) { this.disabled = true; throw new NativeStorageCleanupError(error, cleanupError); }
      throw error;
    } finally { this.busy = false; }
  }
  purgeSources(sourceIds: ReadonlySet<string>) {
    this.enter(); try {
      requireReceipt([...sourceIds].every(uuid), 'INVALID_RECEIPT_SOURCE');
      const names = this.layout.inspect(), selected: string[] = [];
      // Complete prevalidation prevents guessing the scope of corrupt history.
      for (const name of names) if (this.maintenanceRead(name).receipt.dependencies.some(dep => sourceIds.has(dep.sourceId))) selected.push(name);
      for (const name of selected) { this.check(); this.remove(name); }
      if (selected.length) this.layout.sync();
    } catch (error) { this.disabled = true; throw error; } finally { this.busy = false; }
  }
  close() { requireReceipt(!this.busy, 'RECEIPT_STORAGE_BUSY'); this.closed = true; }
}
