/**
 * Injection token for DidYouMeanModule options.
 */
export const DID_YOU_MEAN_OPTIONS = 'DID_YOU_MEAN_OPTIONS';

/**
 * Default configuration options.
 */
export const DEFAULT_OPTIONS = {
  threshold: 0.4,
  maxSuggestions: 3,
  includeMethodInScore: true,
  isGlobalFilter: true,
  format: 'auto' as const,
};
