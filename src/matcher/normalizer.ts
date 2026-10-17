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
