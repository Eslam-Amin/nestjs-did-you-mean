/**
 * Dependency injection token for providing DidYouMeanModule configuration options.
 */
export const DID_YOU_MEAN_OPTIONS = 'DID_YOU_MEAN_OPTIONS';

/**
 * Default configuration values applied when options are omitted.
 */
export const DEFAULT_OPTIONS = {
  /** Default similarity cutoff threshold (0.0 to 1.0) */
  threshold: 0.4,
  /** Default maximum number of suggestions returned */
  maxSuggestions: 3,
  /** Whether to consider HTTP method matching in scoring */
  includeMethodInScore: true,
  /** Whether to automatically bind DidYouMeanFilter globally via APP_FILTER */
  isGlobalFilter: true,
  /** Default response format strategy */
  format: 'auto' as const,
};
