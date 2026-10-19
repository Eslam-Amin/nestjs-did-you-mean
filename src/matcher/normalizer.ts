import { jaroWinklerSimilarity, normalizedLevenshtein } from './similarity';

/**
 * Checks whether a URL segment represents a route parameter (`:param`, `{param}`, or `*wildcard`).
 *
 * @param segment - The single path segment string to check.
 * @returns `true` if the segment represents a dynamic parameter token; otherwise `false`.
 */
export function isParamToken(segment: string): boolean {
  if (!segment) return false;
  return (
    segment.startsWith(':') ||
    (segment.startsWith('{') && segment.endsWith('}')) ||
    segment.startsWith('*')
  );
}

/**
 * Cleans a URL path by removing query strings, fragments, collapsing redundant slashes,
 * and normalizing leading and trailing slashes.
 *
 * @param rawUrl - Raw requested URL string.
 * @returns Normalized URL path with leading slash and without query parameters or trailing slashes.
 */
export function cleanPath(rawUrl: string): string {
  if (!rawUrl) return '/';

  // Strip query string and fragment
  const pathWithoutQuery = rawUrl.split(/[?#]/)[0] ?? '';

  // Collapse multiple consecutive slashes into one
  let cleaned = pathWithoutQuery.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Remove trailing slash if length > 1
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Splits a normalized URL path into non-empty segment strings.
 *
 * @param path - The URL path to segment.
 * @returns Array of individual path segment strings.
 */
export function splitSegments(path: string): string[] {
  return cleanPath(path)
    .split('/')
    .filter(Boolean);
}

/**
 * Normalizes route parameter tokens (`:id`, `{id}`, `*wildcard`) to a uniform `:param` token.
 *
 * @param path - The route path template to normalize.
 * @returns Uniform route pattern string where parameter tokens are mapped to `:param`.
 */
export function normalizeRoutePattern(path: string): string {
  const segments = splitSegments(path);
  const normalizedSegments = segments.map((seg) => (isParamToken(seg) ? ':param' : seg));
  return '/' + normalizedSegments.join('/');
}

/**
 * Determines whether a target path matches a candidate route template structurally
 * (e.g., `/api/users/42` matches candidate `/api/users/:id`).
 *
 * @param targetPath - The concrete requested URL path.
 * @param candidatePath - The candidate registered route template.
 * @returns `true` if the target matches the candidate structure; otherwise `false`.
 */
export function isExactPathMatch(targetPath: string, candidatePath: string): boolean {
  const targetClean = cleanPath(targetPath);
  const candidateClean = cleanPath(candidatePath);

  if (targetClean === candidateClean) {
    return true;
  }

  const targetSegs = splitSegments(targetClean);
  const candidateSegs = splitSegments(candidateClean);

  if (targetSegs.length !== candidateSegs.length) {
    return false;
  }

  for (let i = 0; i < targetSegs.length; i++) {
    const cSeg = candidateSegs[i];
    const tSeg = targetSegs[i];

    if (isParamToken(cSeg)) {
      // Dynamic parameter in candidate matches any target segment
      continue;
    }

    if (cSeg.toLowerCase() !== tSeg.toLowerCase()) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates structural segment similarity between target and candidate route paths,
 * accounting for parameterized dynamic segments and path depth hierarchy.
 *
 * @param targetSegments - Segments of the requested path.
 * @param candidateSegments - Segments of the candidate registered route.
 * @returns Structural similarity score between 0.0 and 1.0.
 */
export function calculateStructuralSimilarity(
  targetSegments: string[],
  candidateSegments: string[],
): number {
  if (targetSegments.length === 0 && candidateSegments.length === 0) {
    return 1.0;
  }

  const maxLen = Math.max(targetSegments.length, candidateSegments.length);
  if (maxLen === 0) return 1.0;

  let totalScore = 0;

  for (let i = 0; i < maxLen; i++) {
    const tSeg = targetSegments[i];
    const cSeg = candidateSegments[i];

    if (!tSeg || !cSeg) {
      // Segment count mismatch penalty for this index
      continue;
    }

    if (isParamToken(cSeg)) {
      // Parameter token matches any target segment with high confidence
      totalScore += 0.95;
    } else {
      const lev = normalizedLevenshtein(tSeg.toLowerCase(), cSeg.toLowerCase());
      const jaro = jaroWinklerSimilarity(tSeg.toLowerCase(), cSeg.toLowerCase());
      totalScore += 0.4 * lev + 0.6 * jaro;
    }
  }

  // Length ratio penalty
  const lengthPenalty = Math.min(targetSegments.length, candidateSegments.length) / maxLen;
  const rawScore = totalScore / maxLen;

  return Math.min(1.0, rawScore * (0.8 + 0.2 * lengthPenalty));
}
