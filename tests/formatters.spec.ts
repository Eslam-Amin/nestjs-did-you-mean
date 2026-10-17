import { describe, expect, it } from 'vitest';
import {
  formatHtmlResponse,
  formatJsonResponse,
  resolveFormattedResponse,
} from '../src/formatters';
import type { FormatContext } from '../src/types';

describe('Formatters', () => {
  const sampleContext: FormatContext = {
    req: { headers: {} },
    res: {},
    method: 'GET',
    url: '/api/v1/usr?tab=1',
    path: '/api/v1/usr',
    statusCode: 404,
    error: 'Not Found',
    message: 'Cannot GET /api/v1/usr',
    suggestions: [
      {
        method: 'GET',
        path: '/api/v1/users',
        score: 0.88,
        isMethodMismatch: false,
        summary: 'Get all users',
      },
      {
        method: 'POST',
        path: '/api/v1/users',
        score: 1.0,
        isMethodMismatch: true,
      },
    ],
  };

  it('formats standard JSON payload correctly', () => {
    const json = formatJsonResponse(sampleContext);
    expect(json).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/v1/usr',
      suggestions: sampleContext.suggestions,
    });
  });

  it('formats interactive HTML page with suggestions, method badges, and copy button', () => {
    const html = formatHtmlResponse(sampleContext);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('404 Not Found');
    expect(html).toContain('Cannot GET');
    expect(html).toContain('/api/v1/usr');
    expect(html).toContain('/api/v1/users');
    expect(html).toContain('Method Mismatch');
    expect(html).toContain('88% match');
    expect(html).toContain('Get all users');
    expect(html).toContain('navigator.clipboard.writeText');
  });

  it('handles HTML formatting when no suggestions exist', () => {
    const emptyContext: FormatContext = {
      ...sampleContext,
      suggestions: [],
    };
    const html = formatHtmlResponse(emptyContext);
    expect(html).toContain('No similar routes discovered.');
  });

  it('resolves JSON when format option is "json"', () => {
    const res = resolveFormattedResponse(sampleContext, 'json');
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(res.body.statusCode).toBe(404);
    expect(res.body.suggestions).toHaveLength(2);
  });

  it('resolves HTML when format option is "html"', () => {
    const res = resolveFormattedResponse(sampleContext, 'html');
    expect(res.contentType).toBe('text/html; charset=utf-8');
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  it('resolves HTML automatically when Accept header includes text/html', () => {
    const htmlReqContext: FormatContext = {
      ...sampleContext,
      req: {
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
      },
    };

    const res = resolveFormattedResponse(htmlReqContext, 'auto');
    expect(res.contentType).toBe('text/html; charset=utf-8');
    expect(typeof res.body).toBe('string');
  });

  it('resolves JSON automatically when Accept header prefers json or is default', () => {
    const jsonReqContext: FormatContext = {
      ...sampleContext,
      req: {
        headers: {
          accept: 'application/json',
        },
      },
    };

    const res = resolveFormattedResponse(jsonReqContext, 'auto');
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(res.body.statusCode).toBe(404);
  });

  it('supports custom formatter callback', () => {
    const res = resolveFormattedResponse(sampleContext, (ctx) => ({
      customStatus: ctx.statusCode,
      topPick: ctx.suggestions[0]?.path,
    }));

    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(res.body).toEqual({
      customStatus: 404,
      topPick: '/api/v1/users',
    });
  });
});
