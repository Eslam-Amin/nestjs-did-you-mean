/**
 * Calculates the Levenshtein distance between two strings using O(min(m, n)) space.
 *
 * @param a - First input string.
 * @param b - Second input string.
 * @returns The minimum number of single-character edits (insertions, deletions, substitutions) required to change `a` into `b`.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure 'a' is the shorter string to minimize array allocation
  if (a.length > b.length) {
    const temp = a;
    a = b;
    b = temp;
  }

  const aLen = a.length;
  const bLen = b.length;
  let prevRow = new Array<number>(aLen + 1);
  let currRow = new Array<number>(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prevRow[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    currRow[0] = j;
    const bChar = b.charCodeAt(j - 1);

    for (let i = 1; i <= aLen; i++) {
      const cost = a.charCodeAt(i - 1) === bChar ? 0 : 1;
      currRow[i] = Math.min(
        currRow[i - 1] + 1,      // insertion
        prevRow[i] + 1,          // deletion
        prevRow[i - 1] + cost,   // substitution
      );
    }

    const swap = prevRow;
    prevRow = currRow;
    currRow = swap;
  }

  return prevRow[aLen];
}

/**
 * Calculates normalized Levenshtein similarity score between 0.0 and 1.0.
 *
 * @param a - First input string.
 * @param b - Second input string.
 * @returns Similarity score where 1.0 represents an exact match and 0.0 represents complete dissimilarity.
 */
export function normalizedLevenshtein(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Calculates the Jaro similarity between two strings (0.0 to 1.0).
 *
 * @param s1 - First input string.
 * @param s2 - Second input string.
 * @returns Jaro similarity score between 0.0 (no match) and 1.0 (exact match).
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }

  const halfTranspositions = transpositions / 2;
  return (matches / len1 + matches / len2 + (matches - halfTranspositions) / matches) / 3;
}

/**
 * Calculates the Jaro-Winkler similarity between two strings (0.0 to 1.0),
 * giving higher weight to strings sharing a common prefix.
 *
 * @param s1 - First input string.
 * @param s2 - Second input string.
 * @param prefixScale - Scaling factor for prefix bonus (default: 0.1).
 * @param maxPrefixLength - Maximum prefix length to consider (default: 4).
 * @returns Jaro-Winkler similarity score between 0.0 and 1.0.
 */
export function jaroWinklerSimilarity(
  s1: string,
  s2: string,
  prefixScale = 0.1,
  maxPrefixLength = 4,
): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro === 0 || jaro === 1.0) return jaro;

  // Find common prefix length (up to maxPrefixLength)
  let prefix = 0;
  const max = Math.min(s1.length, s2.length, maxPrefixLength);
  for (let i = 0; i < max; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return Math.min(1.0, jaro + prefix * prefixScale * (1 - jaro));
}
