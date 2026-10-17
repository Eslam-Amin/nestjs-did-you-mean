import { describe, expect, it } from 'vitest';
import { rankSuggestions } from '../src/matcher/ranker';
import type { RouteDefinition } from '../src/types';

describe('Ranker & Similarity Engine', () => {
  const sampleCandidates: RouteDefinition[] = [
    {
      method: 'GET',
      path: '/api/v1/users',
      normalizedPattern: '/api/v1/users',
      segments: ['api', 'v1', 'users'],
    },
    {
      method: 'GET',
      path: '/api/v1/users/:id',
      normalizedPattern: '/api/v1/users/:param',
      segments: ['api', 'v1', 'users', ':id'],
    },
    {
      method: 'POST',
      path: '/api/v1/users',
      normalizedPattern: '/api/v1/users',
      segments: ['api', 'v1', 'users'],
    },
    {
      method: 'GET',
      path: '/api/v1/products',
      normalizedPattern: '/api/v1/products',
      segments: ['api', 'v1', 'products'],
    },
    {
      method: 'GET',
      path: '/api/v1/orders/:orderId/items',
      normalizedPattern: '/api/v1/orders/:param/items',
      segments: ['api', 'v1', 'orders', ':orderId', 'items'],
    },
    {
      method: 'DELETE',
      path: '/api/v1/accounts/:id',
      normalizedPattern: '/api/v1/accounts/:param',
      segments: ['api', 'v1', 'accounts', ':id'],
    },
  ];

  it('suggests closest matching endpoint on typo (/api/v1/usr -> /api/v1/users)', () => {
    const results = rankSuggestions(
      { method: 'GET', path: '/api/v1/usr' },
      sampleCandidates,
      { maxSuggestions: 3, threshold: 0.4 },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('/api/v1/users');
    expect(results[0].method).toBe('GET');
    expect(results[0].score).toBeGreaterThan(0.8);
    expect(results[0].isMethodMismatch).toBe(false);
  });

  it('prioritizes HTTP method mismatch with score 1.0 at the top of suggestions', () => {
    // Only DELETE /api/v1/accounts/:id is defined, client calls GET /api/v1/accounts/123
    const results = rankSuggestions(
      { method: 'GET', path: '/api/v1/accounts/123' },
      sampleCandidates,
    );

    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.method).toBe('DELETE');
    expect(top.path).toBe('/api/v1/accounts/:id');
    expect(top.score).toBe(1.0);
    expect(top.isMethodMismatch).toBe(true);
  });

  it('handles exact path with different method as method mismatch', () => {
    // Only POST and GET /api/v1/users exist; client calls PUT /api/v1/users
    const results = rankSuggestions(
      { method: 'PUT', path: '/api/v1/users' },
      sampleCandidates,
    );

    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.score).toBe(1.0);
    expect(top.isMethodMismatch).toBe(true);
    expect(['GET', 'POST']).toContain(top.method);
  });

  it('handles parameterized structural matching with dynamic parameters (:orderId)', () => {
    const results = rankSuggestions(
      { method: 'GET', path: '/api/v1/orders/999/items' },
      sampleCandidates,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('/api/v1/orders/:orderId/items');
    expect(results[0].method).toBe('GET');
    expect(results[0].score).toBe(1.0);
  });

  it('respects threshold filtering', () => {
    const results = rankSuggestions(
      { method: 'GET', path: '/completely/unrelated/path' },
      sampleCandidates,
      { threshold: 0.8 },
    );

    expect(results).toHaveLength(0);
  });

  it('respects maxSuggestions limit', () => {
    const results = rankSuggestions(
      { method: 'GET', path: '/api/v1' },
      sampleCandidates,
      { maxSuggestions: 2, threshold: 0.1 },
    );

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when candidate list is empty', () => {
    const results = rankSuggestions({ method: 'GET', path: '/api/v1/users' }, []);
    expect(results).toEqual([]);
  });

  it('allows overriding via customRanker option', () => {
    const customResult = [
      { method: 'CUSTOM', path: '/custom/path', score: 0.99, isMethodMismatch: false },
    ];
    const results = rankSuggestions(
      { method: 'GET', path: '/test' },
      sampleCandidates,
      {
        customRanker: () => customResult,
      },
    );

    expect(results).toBe(customResult);
  });

  it('deduplicates identical method and path candidates', () => {
    const duplicateCandidates: RouteDefinition[] = [
      {
        method: 'GET',
        path: '/api/v1/users',
        normalizedPattern: '/api/v1/users',
        segments: ['api', 'v1', 'users'],
      },
      {
        method: 'GET',
        path: '/api/v1/users',
        normalizedPattern: '/api/v1/users',
        segments: ['api', 'v1', 'users'],
      },
    ];

    const results = rankSuggestions(
      { method: 'GET', path: '/api/v1/usr' },
      duplicateCandidates,
    );

    expect(results).toHaveLength(1);
  });
});
