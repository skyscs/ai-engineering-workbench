/** Search-only normalization; evidence bytes, hashes and line ranges stay original. */
export function searchText(text: string): string {
  return text.replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ').toLowerCase();
}

export function spanSearchText(filePath: string, text: string): string {
  // Keep original identifiers as well as their parts for exact-symbol questions.
  return `${filePath}\n${text}\n${searchText(filePath)}\n${searchText(text)}`;
}
