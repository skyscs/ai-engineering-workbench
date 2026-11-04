// Saved path coverage, ported from the qualified Task 067 reader without repository reads.
import { createHash } from 'node:crypto';
import { CatalogError } from './types.js';
const sourceFields = ['sourceId', 'name', 'revision', 'tree', 'status', 'omitted'];
const fileFields = ['id', 'sourceId', 'path', 'mode', 'blob', 'size', 'status', 'reason', 'contentHash'];
const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const regular = (mode) => mode === '100644' || mode === '100755';
const codePath = (value) => /\.(ts|js|vue|java)$/i.test(value);
const safePath = (value) => value.length > 0 && value.length <= 4096 && !/[\\\u0000-\u001f\u007f]/.test(value)
    && !value.startsWith('/') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
function checked(condition, message, code = 'CORRUPT_PATH_METADATA') {
    if (!condition)
        throw new CatalogError(code, message, 409);
}
export function metadataFrame(kind, values) {
    return kind + values.map(value => value === null ? '-1:' : `${Buffer.byteLength(String(value))}:${value}`).join('') + '\n';
}
const rowBytesSql = (fields) => '2+' + fields.map(field => `(CASE WHEN ${field} IS NULL THEN 3 ELSE
  length(CAST(${field} AS BLOB))+length(CAST(length(CAST(${field} AS BLOB)) AS TEXT))+1 END)`).join('+');
async function pathTree(entries, work) {
    const root = { name: '', children: new Map() };
    for (const entry of entries) {
        checked(typeof entry.path === 'string' && entry.path.length <= 4096 && !entry.path.includes('\0'), 'Invalid tree path.');
        checked(/^\d{6}$/.test(entry.mode) && !/[89]/.test(entry.mode) && oid.test(entry.blob), 'Invalid tree entry.');
        const parts = entry.path.split('/');
        let parent = root;
        for (let i = 0; i < parts.length; i++) {
            await work.step('metadata');
            const name = parts[i];
            checked(name.length > 0 && parent.children, 'File/ancestor collision in saved paths.');
            const existing = parent.children.get(name);
            if (i === parts.length - 1) {
                checked(!existing, 'Duplicate or colliding saved path.');
                parent.children.set(name, { ...entry, name });
            }
            else {
                if (!existing)
                    parent.children.set(name, { name, children: new Map() });
                parent = parent.children.get(name);
            }
        }
    }
    return root;
}
async function hashTree(root, expected, work) {
    checked(oid.test(expected), 'Invalid saved root tree.');
    const algorithm = expected.length === 40 ? 'sha1' : 'sha256';
    const stack = [[root, false]];
    while (stack.length) {
        const [tree, visited] = stack.pop();
        await work.step('metadata');
        if (!visited) {
            stack.push([tree, true]);
            for (const child of tree.children.values()) {
                await work.step('metadata');
                if (child.children)
                    stack.push([child, false]);
                else
                    checked(child.blob.length === expected.length, 'Mixed object formats in saved tree.');
            }
            continue;
        }
        const entries = [];
        for (const child of tree.children.values()) {
            await work.step('metadata');
            const mode = child.children ? '40000' : parseInt(child.mode, 8).toString(8);
            entries.push({ prefix: Buffer.from(`${mode} ${child.name}\0`), blob: Buffer.from(child.blob, 'hex'),
                sort: Buffer.from(child.name + (mode === '40000' ? '/' : '\0')) });
        }
        // One bounded synchronous byte sort per directory; no object/prototype path lookup.
        entries.sort((a, b) => Buffer.compare(a.sort, b.sort));
        const bytes = entries.reduce((sum, entry) => sum + entry.prefix.length + entry.blob.length, 0);
        const hash = createHash(algorithm).update(`tree ${bytes}\0`);
        for (const entry of entries) {
            await work.step('metadata', 1 + Math.ceil((entry.prefix.length + entry.blob.length) / 1024));
            hash.update(entry.prefix).update(entry.blob);
        }
        tree.blob = hash.digest('hex');
    }
    checked(root.blob === expected, 'Saved paths do not match the recorded Git tree.', 'CORRUPT_PATH_TREE');
    return root.blob;
}
export async function verifySavedTree(entries, expected, work) {
    return hashTree(await pathTree(entries, work), expected, work);
}
async function readMetadataRows(catalog, buildId, work, limits, retain) {
    await work.step('metadata', 0, true);
    const sourceSize = catalog.store.one(`SELECT count(*) count,coalesce(sum(${rowBytesSql(sourceFields)}),0) bytes FROM build_sources WHERE buildId=?`, buildId);
    const fileSize = catalog.store.one(`SELECT count(*) count,coalesce(sum(${rowBytesSql(fileFields)}),0) bytes FROM files WHERE buildId=?`, buildId);
    checked(sourceSize.count <= 20 && fileSize.count <= limits.metadataEntries, 'Saved path entry bound exceeded.', 'METADATA_LIMIT');
    checked(sourceSize.bytes + fileSize.bytes <= limits.metadataBytes, 'Saved path byte bound exceeded.', 'METADATA_LIMIT');
    const sources = new Map(), files = new Map(), digest = createHash('sha256');
    let bytes = 0, count = 0;
    const encode = async (kind, values) => {
        await work.step('metadata', values.length);
        const frame = metadataFrame(kind, values);
        bytes += Buffer.byteLength(frame);
        checked(bytes <= limits.metadataBytes, 'Saved path byte bound exceeded.', 'METADATA_LIMIT');
        digest.update(frame);
    };
    for (const row of catalog.store.all(`SELECT ${sourceFields.join(',')} FROM build_sources WHERE buildId=? ORDER BY sourceId LIMIT 21`, buildId)) {
        checked(typeof row.sourceId === 'string' && row.sourceId.length > 0 && !sources.has(row.sourceId)
            && typeof row.name === 'string' && ['pending', 'ready', 'failed'].includes(row.status)
            && Number.isSafeInteger(row.omitted) && row.omitted >= 0
            && (row.revision === null || oid.test(row.revision)) && (row.tree === null || oid.test(row.tree)), 'Invalid saved source header.');
        checked(row.status !== 'ready' || row.revision && row.tree && row.revision.length === row.tree.length, 'Ready source has no compatible Git identity.');
        await encode('S', sourceFields.map(field => row[field]));
        sources.set(row.sourceId, { ...row, files: [], byPath: new Map(), unsafe: false, opaque: [], treeVerified: false });
    }
    for (let offset = 0; offset < fileSize.count; offset += 128) {
        const rows = catalog.store.all(`SELECT ${fileFields.join(',')} FROM files WHERE buildId=? ORDER BY sourceId,path,id LIMIT 128 OFFSET ?`, buildId, offset);
        for (const row of rows) {
            const source = sources.get(row.sourceId);
            checked(source && typeof row.id === 'string' && row.id.length > 0 && typeof row.path === 'string'
                && row.path.length > 0 && row.path.length <= 4096 && !row.path.includes('\0')
                && /^[0-7]{6}$/.test(row.mode) && oid.test(row.blob) && Number.isSafeInteger(row.size) && row.size >= 0
                && ['indexed', 'excluded', 'failed', 'purged'].includes(row.status)
                && (row.reason === null || typeof row.reason === 'string')
                && (row.contentHash === null || /^[a-f0-9]{64}$/.test(row.contentHash)), 'Invalid saved file metadata.');
            await encode('F', fileFields.map(field => row[field]));
            count++;
            if (retain) {
                checked(!files.has(row.id) && !source.byPath.has(row.path), 'Duplicate saved file identity.');
                files.set(row.id, row);
                source.files.push(row);
                source.byPath.set(row.path, row);
                source.unsafe ||= !safePath(row.path);
                if (!regular(row.mode))
                    source.opaque.push(row.path);
            }
        }
    }
    checked(count === fileSize.count && sources.size === sourceSize.count && bytes === sourceSize.bytes + fileSize.bytes, 'Saved metadata changed while reading.');
    return { digest: digest.digest('hex'), bytes, entries: count, sources, files };
}
export async function bindingMetadata(catalog, analysis, snapshot, work, limits) {
    const metadata = await readMetadataRows(catalog, snapshot.summary.buildId, work, limits, true), units = new Map();
    for (let offset = 0; offset < snapshot.summary.candidates; offset += 50) {
        for (const unit of analysis.files(snapshot.summary.id, offset)) {
            await work.step('metadata');
            const file = metadata.files.get(unit.fileId);
            checked(file && file.status === 'indexed' && codePath(file.path) && file.sourceId === unit.sourceId && file.path === unit.path
                && !units.has(unit.fileId), 'Code manifest does not match saved paths.');
            units.set(unit.fileId, unit);
        }
    }
    for (const file of metadata.files.values()) {
        await work.step('metadata');
        checked(file.status !== 'indexed' || !codePath(file.path) || units.has(file.id), 'Indexed code path missing from published manifest.');
    }
    checked(units.size === snapshot.summary.candidates, 'Code manifest path count differs.');
    for (const source of metadata.sources.values()) {
        const tree = await pathTree(source.files, work);
        if (source.status === 'ready' && source.omitted === 0) {
            await hashTree(tree, source.tree, work);
            source.treeVerified = true;
        }
    }
    return { ...metadata, units };
}
export async function assertBindingMetadata(catalog, buildId, metadata, work, limits) {
    const final = await readMetadataRows(catalog, buildId, work, limits, false);
    checked(final.digest === metadata.digest, 'Saved path metadata changed before publication.', 'METADATA_CHANGED');
}
export async function bindingDomains(metadata, entries, work) {
    const payloads = new Map(entries.map(entry => [entry.file.id, entry.payload]));
    const globalReasons = (source) => {
        const reasons = {};
        if (!source || source.status !== 'ready' || source.omitted > 0 || !source.treeVerified)
            reasons['unknown-source-paths'] = 1;
        if (source?.unsafe)
            reasons['unsafe-source-paths'] = 1;
        return reasons;
    };
    const fileReasons = (file, reasons) => {
        const add = (name) => { reasons[name] = (reasons[name] ?? 0) + 1; };
        if (file.status !== 'indexed') {
            add('index-content-unavailable');
            return;
        }
        if (metadata.units.get(file.id)?.status !== 'parsed') {
            add('code-facts-unavailable');
            return;
        }
        const payload = payloads.get(file.id);
        checked(payload, 'Parsed target facts missing.');
        if (payload.facts.gaps.length)
            add('target-parser-gaps');
    };
    const java = new Map(), summaries = [];
    for (const source of metadata.sources.values()) {
        const reasons = globalReasons(source);
        let candidateFiles = 0, filesWithGaps = 0;
        if (source.opaque.length)
            reasons['opaque-java-boundary'] = source.opaque.length;
        for (const file of source.files) {
            await work.step('read');
            if (payloads.get(file.id)?.facts.gaps.length)
                filesWithGaps++;
            if (/\.java$/i.test(file.path)) {
                candidateFiles++;
                fileReasons(file, reasons);
                if (!file.path.endsWith('.java'))
                    reasons['uncertain-java-profile'] = (reasons['uncertain-java-profile'] ?? 0) + 1;
            }
        }
        const domain = { kind: 'java-source', complete: Object.keys(reasons).length === 0, reasons, candidateFiles };
        java.set(source.sourceId, domain);
        summaries.push({ sourceId: source.sourceId, knownPaths: source.files.length, status: source.status, omittedPaths: source.omitted,
            treeVerified: source.treeVerified, opaquePaths: source.opaque.length, unsafePaths: source.unsafe, filesWithGaps,
            javaFiles: candidateFiles, javaComplete: domain.complete });
    }
    return { summaries,
        java(sourceId) { work.charge(); return java.get(sourceId) ?? { kind: 'java-source', complete: false, reasons: { 'unknown-source-paths': 1 }, candidateFiles: 0 }; },
        imports(sourceId, paths) {
            const source = metadata.sources.get(sourceId), reasons = globalReasons(source);
            let candidateFiles = 0;
            for (const target of paths) {
                work.charge();
                if (!safePath(target))
                    reasons['unsafe-import-path'] = (reasons['unsafe-import-path'] ?? 0) + 1;
                // Exact path ancestors suffice; do not scan every opaque source entry per import.
                const parts = target.split('/');
                let prefix = '';
                for (const part of parts) {
                    work.charge();
                    prefix = prefix ? `${prefix}/${part}` : part;
                    const entry = source?.byPath.get(prefix);
                    if (entry && !regular(entry.mode))
                        reasons['opaque-import-boundary'] = (reasons['opaque-import-boundary'] ?? 0) + 1;
                }
                const file = source?.byPath.get(target);
                if (file) {
                    candidateFiles++;
                    fileReasons(file, reasons);
                }
            }
            return { kind: 'import-paths', complete: Object.keys(reasons).length === 0, reasons, candidateFiles, paths };
        } };
}
