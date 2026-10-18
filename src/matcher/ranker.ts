import { DEFAULT_OPTIONS } from '../constants';
import type { DidYouMeanModuleOptions, RouteDefinition, RouteSuggestion } from '../types';
import {
  calculateStructuralSimilarity,
  cleanPath,
  isExactPathMatch,
  splitSegments,
} from './normalizer';
import { jaroWinklerSimilarity, normalizedLevenshtein } from './similarity';

/**
 * Endpoint target being requested by a client.
 */
export interface EndpointTarget {
  /** HTTP method of the incoming request (e.g., 'GET', 'POST') */
  method: string;
  /** Requested URL path */
  path: string;
}

/**
 * Calculates similarity between a requested endpoint and registered candidate routes,
 * ranking them with method mismatch prioritization, structural matching, and threshold filtering.
 *
 * @param target - The requested HTTP method and path.
 * @param candidates - List of harvested application route definitions.
 * @param options - Configuration options controlling threshold, limits, and scoring.
 * @returns Sorted list of closest matching route suggestions.
 */
export function rankSuggestions(
  target: EndpointTarget,
  candidates: RouteDefinition[],
  options: DidYouMeanModuleOptions = {},
): RouteSuggestion[] {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  // Use custom ranker if provided
  if (options.customRanker) {
    return options.customRanker(target, candidates, options);
  }

  const threshold = options.threshold ?? DEFAULT_OPTIONS.threshold;
  const maxSuggestions = options.maxSuggestions ?? DEFAULT_OPTIONS.maxSuggestions;
  const includeMethod = options.includeMethodInScore ?? DEFAULT_OPTIONS.includeMethodInScore;

  const targetClean = cleanPath(target.path);
  const targetMethod = (target.method || 'GET').toUpperCase();
  const targetSegs = splitSegments(targetClean);

  const scoredList: RouteSuggestion[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const candidateMethod = (candidate.method || 'GET').toUpperCase();
    const candidateClean = cleanPath(candidate.path);
    const key = `${candidateMethod}:${candidateClean}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    // Check for exact path match
    const exactPath = isExactPathMatch(targetClean, candidateClean);

    let score = 0;
    let isMethodMismatch = false;

    if (exactPath) {
      if (candidateMethod !== targetMethod && candidateMethod !== 'ALL') {
        // Priority: HTTP Method Mismatch on exact or parameterized path match
        score = 1.0;
        isMethodMismatch = true;
      } else {
        score = 1.0;
        isMethodMismatch = false;
      }
    } else {
      // Fuzzy string similarity
      const lev = normalizedLevenshtein(targetClean.toLowerCase(), candidateClean.toLowerCase());
      const jaro = jaroWinklerSimilarity(targetClean.toLowerCase(), candidateClean.toLowerCase());
      const fullPathScore = 0.4 * lev + 0.6 * jaro;

      // Segment-based structural similarity
      const structScore = calculateStructuralSimilarity(
        targetSegs,
        candidate.segments.length > 0 ? candidate.segments : splitSegments(candidateClean),
      );

      // Combined path similarity
      const pathScore = 0.4 * fullPathScore + 0.6 * structScore;

      if (includeMethod && candidateMethod !== targetMethod && candidateMethod !== 'ALL') {
        // Mild penalty when methods differ on fuzzy path
        score = pathScore * 0.85;
      } else {
        score = pathScore;
      }

      isMethodMismatch = false;
    }

    // Round score to two decimals
    const roundedScore = Math.round(score * 100) / 100;

    if (roundedScore >= threshold) {
      scoredList.push({
        method: candidateMethod,
        path: candidate.path,
        score: roundedScore,
        isMethodMismatch,
        summary: candidate.summary,
        operationId: candidate.operationId,
      });
    }
  }

  // Sort candidates:
  // 1. isMethodMismatch (exact path matches under different method always prioritized)
  // 2. score descending
  // 3. alphabetical path for stability
  scoredList.sort((a, b) => {
    if (a.isMethodMismatch && !b.isMethodMismatch) return -1;
    if (!a.isMethodMismatch && b.isMethodMismatch) return 1;

    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.path.localeCompare(b.path);
  });

  return scoredList.slice(0, maxSuggestions);
}
