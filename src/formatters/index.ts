import type {
  DidYouMeanModuleOptions,
  DidYouMeanResponsePayload,
  FormatContext,
} from '../types';

/**
 * Formats suggestions into the standard JSON error payload.
 */
export function formatJsonResponse(context: FormatContext): DidYouMeanResponsePayload {
  return {
    statusCode: context.statusCode,
    error: context.error,
    message: context.message || `Cannot ${context.method} ${context.path}`,
    suggestions: context.suggestions,
  };
}
