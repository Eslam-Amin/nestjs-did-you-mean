import { describe, expect, it } from 'vitest';
import {
  jaroSimilarity,
  jaroWinklerSimilarity,
  levenshteinDistance,
  normalizedLevenshtein,
} from '../src/matcher/similarity';

describe('Similarity Algorithms', () => {
  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('users', 'users')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('returns length of other string when one is empty', () => {
      expect(levenshteinDistance('', 'users')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });

    it('computes correct edit distance for substitutions, additions, deletions', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('usr', 'user')).toBe(1);
      expect(levenshteinDistance('usr', 'users')).toBe(2);
    });
  });

  describe('normalizedLevenshtein', () => {
    it('returns 1.0 for identical strings', () => {
      expect(normalizedLevenshtein('test', 'test')).toBe(1.0);
      expect(normalizedLevenshtein('', '')).toBe(1.0);
    });

    it('returns 0.0 when distance equals max length', () => {
      expect(normalizedLevenshtein('abc', 'xyz')).toBe(0.0);
    });

    it('returns proportional score between 0.0 and 1.0', () => {
      const score = normalizedLevenshtein('user', 'users');
      expect(score).toBeCloseTo(0.8, 2);
    });
  });

  describe('jaroSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(jaroSimilarity('test', 'test')).toBe(1.0);
    });

    it('returns 0.0 for empty strings', () => {
      expect(jaroSimilarity('', 'test')).toBe(0.0);
      expect(jaroSimilarity('test', '')).toBe(0.0);
    });

    it('returns 0.0 for completely disjoint strings', () => {
      expect(jaroSimilarity('abc', 'xyz')).toBe(0.0);
    });

    it('computes expected Jaro similarity with transpositions', () => {
      const score = jaroSimilarity('dwayne', 'duane');
      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThan(0.9);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(jaroWinklerSimilarity('route', 'route')).toBe(1.0);
    });

    it('returns 0.0 for disjoint strings with no match', () => {
      expect(jaroWinklerSimilarity('abc', 'xyz')).toBe(0.0);
    });

    it('gives higher score to strings sharing common prefix than standard Jaro', () => {
      const jaro = jaroSimilarity('userProfile', 'userSetting');
      const jaroWinkler = jaroWinklerSimilarity('userProfile', 'userSetting');
      expect(jaroWinkler).toBeGreaterThan(jaro);
    });
  });
});
