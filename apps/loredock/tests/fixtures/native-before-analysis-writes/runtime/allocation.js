/** Fixed equal shares, including deterministic remainder, never borrowed across sources. */
export function share(budget, count, index) { return Math.floor(budget / count) + Number(index < budget % count); }
export function baselineOrder(a, b) {
    const rank = (entry) => /^(readme|readme\.md|readme\.txt)$/i.test(entry.path) ? 0 : /^(package\.json|pom\.xml)$/.test(entry.path) ? 1 : 2;
    return rank(a) - rank(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
