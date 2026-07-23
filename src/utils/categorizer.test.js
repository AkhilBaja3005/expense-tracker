import { describe, it, expect, beforeEach } from 'vitest';
import { suggestCategory, learnCategory } from './categorizer';

describe('suggestCategory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns Others for empty or non-string input', () => {
    expect(suggestCategory('')).toBe('Others');
    expect(suggestCategory(null)).toBe('Others');
    expect(suggestCategory(undefined)).toBe('Others');
  });

  it('matches a keyword to its category', () => {
    expect(suggestCategory('Starbucks Coffee')).toBe('Food');
    expect(suggestCategory('Uber ride home')).toBe('Transport');
    expect(suggestCategory('Netflix subscription')).toBe('Bills');
  });

  it('falls back to Others when no keyword matches', () => {
    expect(suggestCategory('xyz totally unknown vendor')).toBe('Others');
  });

  it('is case-insensitive', () => {
    expect(suggestCategory('STARBUCKS')).toBe('Food');
  });

  it('prefers a custom learned rule over keyword matching', () => {
    learnCategory('my weird vendor', 'Entertainment');
    expect(suggestCategory('my weird vendor')).toBe('Entertainment');
  });

  it('learnCategory is case/whitespace-insensitive on lookup', () => {
    learnCategory('  My Vendor  ', 'Health');
    expect(suggestCategory('my vendor')).toBe('Health');
  });

  it('ignores learnCategory calls with an invalid category key', () => {
    learnCategory('bad vendor', 'NotARealCategory');
    expect(suggestCategory('bad vendor')).toBe('Others');
  });
});
