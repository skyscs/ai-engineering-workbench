import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, opendirSync, mkdirSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import { NativeReceiptError, record, requireReceipt, uuid } from './native-receipt-json.js';
export const nativeStorageLimits = Object.freeze({ records: 64, bytes: 640 * 1024 });
export function storageLimits(options) {
    requireReceipt(record(options) && Object.keys(options).every(key => ['limits', 'observe'].includes(key))
        && (options.limits === undefined || record(options.limits)), 'INVALID_RECEIPT_STORAGE_LIMIT');
    const limits = { ...nativeStorageLimits, ...options.limits };
    for (const [key, value] of Object.entries(limits))
        requireReceipt(Object.hasOwn(nativeStorageLimits, key)
            && Number.isSafeInteger(value) && value >= 0 && value <= nativeStorageLimits[key], 'INVALID_RECEIPT_STORAGE_LIMIT');
    requireReceipt(options.observe === undefined || typeof options.observe === 'function', 'INVALID_RECEIPT_STORAGE_HOOK');
    return limits;
}
export function storageHook(options, stage, name) {
    const result = options.observe?.(stage, name);
    requireReceipt(!(result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result && result.then), 'INVALID_RECEIPT_STORAGE_HOOK');
}
export const missing = (error) => error?.code === 'ENOENT';
export function exists(file) { try {
    lstatSync(file);
    return true;
}
catch (error) {
    if (missing(error))
        return false;
    throw error;
} }
export function regularSize(file, maximum) {
    const stat = lstatSync(file);
    requireReceipt(stat.isFile() && !stat.isSymbolicLink(), 'UNSAFE_RECEIPT_FILE');
    requireReceipt(stat.size <= maximum, 'RECEIPT_BYTES_LIMIT');
    return stat;
}
/** At most the descriptor's validated length plus one; growth never widens allocation. */
export function readBounded(file, maximum, options) {
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
        const before = fstatSync(fd);
        requireReceipt(before.isFile(), 'UNSAFE_RECEIPT_FILE');
        requireReceipt(before.size <= maximum, 'RECEIPT_BYTES_LIMIT');
        storageHook(options, 'read-sized', path.basename(file));
        const buffer = Buffer.alloc(before.size + 1);
        let used = 0;
        while (used < buffer.length) {
            const count = readSync(fd, buffer, used, buffer.length - used, null);
            if (!count)
                break;
            used += count;
        }
        const after = fstatSync(fd);
        requireReceipt(used === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, 'RECEIPT_FILE_CHANGED');
        return buffer.subarray(0, used);
    }
    finally {
        closeSync(fd);
    }
}
function entries(folder, maximum, accept, errorCode) {
    const directory = opendirSync(folder, { bufferSize: 1 }), names = [];
    try {
        let item;
        while ((item = directory.readSync()) !== null) {
            requireReceipt(accept(item.name), errorCode);
            requireReceipt(names.length < maximum, 'RECEIPT_DIRECTORY_LIMIT');
            names.push(item.name);
        }
    }
    finally {
        directory.closeSync();
    }
    return names;
}
function directory(file) {
    const stat = lstatSync(file);
    requireReceipt(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_RECEIPT_DIRECTORY');
    return stat;
}
/** Fixed catalog-relative layout only. Empty stores need no directories. */
export class ReceiptLayout {
    catalogId;
    options;
    limits;
    parent;
    root;
    identity;
    constructor(directory, catalogId, options, limits) {
        this.catalogId = catalogId;
        this.options = options;
        this.limits = limits;
        requireReceipt(uuid(catalogId), 'INVALID_CATALOG_ID');
        this.parent = path.join(directory, 'path-receipts');
        this.root = path.join(this.parent, catalogId);
    }
    inspect(allowPending = false) {
        if (!exists(this.parent)) {
            requireReceipt(!this.identity, 'RECEIPT_DIRECTORY_CHANGED');
            return [];
        }
        directory(this.parent);
        const children = entries(this.parent, 1, name => name === this.catalogId, 'FOREIGN_RECEIPT_DIRECTORY');
        requireReceipt(children.every(name => name === this.catalogId), 'FOREIGN_RECEIPT_DIRECTORY');
        if (!children.length) {
            requireReceipt(!this.identity, 'RECEIPT_DIRECTORY_CHANGED');
            return [];
        }
        const stat = directory(this.root);
        if (this.identity)
            requireReceipt(stat.dev === this.identity.dev && stat.ino === this.identity.ino, 'RECEIPT_DIRECTORY_CHANGED');
        else
            this.identity = { dev: stat.dev, ino: stat.ino };
        const names = entries(this.root, this.limits.records + 1, name => /^[a-f0-9]{64}\.json$/.test(name) || (allowPending && name === '.pending'), 'UNEXPECTED_RECEIPT_FILE');
        let records = 0;
        for (const name of names) {
            requireReceipt(/^[a-f0-9]{64}\.json$/.test(name) || (allowPending && name === '.pending'), 'UNEXPECTED_RECEIPT_FILE');
            regularSize(path.join(this.root, name), this.limits.bytes);
            if (name !== '.pending')
                records++;
        }
        requireReceipt(records <= this.limits.records, 'RECEIPT_DIRECTORY_LIMIT');
        return names.sort();
    }
    create() {
        this.inspect();
        if (!exists(this.parent)) {
            mkdirSync(this.parent, { mode: 0o700 });
            this.sync(path.dirname(this.parent));
        }
        directory(this.parent);
        if (!exists(this.root)) {
            mkdirSync(this.root, { mode: 0o700 });
            this.sync(this.parent);
        }
        this.inspect();
    }
    sync(folder = this.root) {
        storageHook(this.options, 'before-sync', path.basename(folder));
        const fd = openSync(folder, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try {
            fsyncSync(fd);
        }
        finally {
            closeSync(fd);
        }
    }
}
export class NativeStorageCleanupError extends NativeReceiptError {
    operationError;
    cleanupError;
    constructor(operationError, cleanupError) {
        super('RECEIPT_CLEANUP_FAILED', 'Native receipt cleanup failed; reopen storage after repairing the recorded files.');
        this.operationError = operationError;
        this.cleanupError = cleanupError;
    }
}
