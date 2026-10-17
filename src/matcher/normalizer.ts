import { jaroWinklerSimilarity, normalizedLevenshtein } from './similarity';

/**
 * Checks whether a URL segment represents a route parameter (:param, {param}, or *wildcard).
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
 * Cleans a URL path by removing query string, hash, collapsing redundant slashes,
 * and normalizing leading/trailing slashes.
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
 * Splits a path into non-empty segments.
 */
export function splitSegments(path: string): string[] {
  return cleanPath(path)
    .split('/')
    .filter(Boolean);
}

/**
 * Normalizes route parameter tokens (:id, {id}, *wildcard) to a uniform ':param'.
 */
export function normalizeRoutePattern(path: string): string {
  const segments = splitSegments(path);
  const normalizedSegments = segments.map((seg) => (isParamToken(seg) ? ':param' : seg));
  return '/' + normalizedSegments.join('/');
}

/**
 * Determines whether a target path matches a candidate route template structurally.
 * (e.g. '/api/users/42' matches '/api/users/:id').
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
