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
