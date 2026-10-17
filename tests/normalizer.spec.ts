import { describe, expect, it } from 'vitest';
import {
  calculateStructuralSimilarity,
  cleanPath,
  isExactPathMatch,
  isParamToken,
  normalizeRoutePattern,
  splitSegments,
} from '../src/matcher/normalizer';

describe('Normalizer & Path Matching', () => {
  describe('cleanPath', () => {
    it('strips query parameters and hashes', () => {
      expect(cleanPath('/api/v1/users?page=1&sort=asc')).toBe('/api/v1/users');
      expect(cleanPath('/api/v1/users#section')).toBe('/api/v1/users');
      expect(cleanPath('/api/v1/users?page=1#section')).toBe('/api/v1/users');
    });

    it('collapses consecutive duplicate slashes', () => {
      expect(cleanPath('///api///v1//users/')).toBe('/api/v1/users');
    });

    it('ensures leading slash and removes trailing slash', () => {
      expect(cleanPath('api/users')).toBe('/api/users');
      expect(cleanPath('/api/users/')).toBe('/api/users');
      expect(cleanPath('/')).toBe('/');
      expect(cleanPath('')).toBe('/');
    });
  });

  describe('isParamToken', () => {
    it('recognizes NestJS :param tokens', () => {
      expect(isParamToken(':id')).toBe(true);
      expect(isParamToken(':userId')).toBe(true);
    });

    it('recognizes OpenAPI {param} tokens', () => {
      expect(isParamToken('{id}')).toBe(true);
      expect(isParamToken('{userId}')).toBe(true);
    });

    it('recognizes wildcard tokens', () => {
      expect(isParamToken('*')).toBe(true);
      expect(isParamToken('*wildcard')).toBe(true);
    });

    it('returns false for static segments', () => {
      expect(isParamToken('users')).toBe(false);
      expect(isParamToken('api')).toBe(false);
      expect(isParamToken('')).toBe(false);
    });
  });

  describe('normalizeRoutePattern', () => {
    it('normalizes parameterized segments to :param', () => {
      expect(normalizeRoutePattern('/users/:id/posts/{postId}')).toBe(
        '/users/:param/posts/:param',
      );
    });
  });

  describe('splitSegments', () => {
    it('splits path into non-empty segments', () => {
      expect(splitSegments('/api/v1/users/')).toEqual(['api', 'v1', 'users']);
      expect(splitSegments('/')).toEqual([]);
    });
  });

  describe('isExactPathMatch', () => {
    it('returns true for identical paths', () => {
      expect(isExactPathMatch('/api/users', '/api/users')).toBe(true);
      expect(isExactPathMatch('/api/users/', '/api/users')).toBe(true);
    });

    it('returns true when candidate has parameter token matching target value', () => {
      expect(isExactPathMatch('/api/users/42', '/api/users/:id')).toBe(true);
      expect(isExactPathMatch('/api/users/abc-123/posts/5', '/api/users/:userId/posts/:postId')).toBe(
        true,
      );
    });

    it('returns false when segment count differs', () => {
      expect(isExactPathMatch('/api/users', '/api/users/:id')).toBe(false);
      expect(isExactPathMatch('/api/users/123/extra', '/api/users/:id')).toBe(false);
    });

    it('returns false when static segments do not match', () => {
      expect(isExactPathMatch('/api/posts/42', '/api/users/:id')).toBe(false);
    });
  });

  describe('calculateStructuralSimilarity', () => {
    it('returns 1.0 when both segment lists are empty', () => {
      expect(calculateStructuralSimilarity([], [])).toBe(1.0);
    });

    it('scores high when parameterized tokens match', () => {
      const score = calculateStructuralSimilarity(
        ['api', 'v1', 'users', '123'],
        ['api', 'v1', 'users', ':id'],
      );
      expect(score).toBeGreaterThan(0.9);
    });

    it('penalizes segment count difference', () => {
      const scoreEqual = calculateStructuralSimilarity(
        ['api', 'v1', 'users'],
        ['api', 'v1', 'users'],
      );
      const scoreDiff = calculateStructuralSimilarity(
        ['api', 'v1', 'users'],
        ['api', 'v1', 'users', 'extra', 'segments'],
      );
      expect(scoreEqual).toBe(1.0);
      expect(scoreDiff).toBeLessThan(0.7);
    });
  });
});
