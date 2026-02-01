import { describe, it, expect } from 'vitest';
import {
  getOrpIndex,
  extractWordBody,
  splitTokenForOrp,
  getOrpCenterOffset,
} from '../orp';

describe('getOrpIndex', () => {
  it('returns 0 for empty or single char words', () => {
    expect(getOrpIndex(0)).toBe(0);
    expect(getOrpIndex(1)).toBe(0);
  });

  it('returns 0 for 1-2 char words', () => {
    expect(getOrpIndex(1)).toBe(0);
    expect(getOrpIndex(2)).toBe(0);
  });

  it('returns 1 for 3-5 char words', () => {
    expect(getOrpIndex(3)).toBe(1);
    expect(getOrpIndex(4)).toBe(1);
    expect(getOrpIndex(5)).toBe(1);
  });

  it('returns 2 for 6-9 char words', () => {
    expect(getOrpIndex(6)).toBe(2);
    expect(getOrpIndex(7)).toBe(2);
    expect(getOrpIndex(8)).toBe(2);
    expect(getOrpIndex(9)).toBe(2);
  });

  it('returns 3 for 10-13 char words', () => {
    expect(getOrpIndex(10)).toBe(3);
    expect(getOrpIndex(11)).toBe(3);
    expect(getOrpIndex(12)).toBe(3);
    expect(getOrpIndex(13)).toBe(3);
  });

  it('returns 4 for 14+ char words', () => {
    expect(getOrpIndex(14)).toBe(4);
    expect(getOrpIndex(15)).toBe(4);
    expect(getOrpIndex(20)).toBe(4);
    expect(getOrpIndex(100)).toBe(4);
  });
});

describe('extractWordBody', () => {
  it('handles simple words without punctuation', () => {
    const result = extractWordBody('hello');
    expect(result).toEqual({
      prefix: '',
      body: 'hello',
      suffix: '',
      bodyStart: 0,
      bodyEnd: 5,
    });
  });

  it('handles words with trailing punctuation', () => {
    const result = extractWordBody('hello,');
    expect(result).toEqual({
      prefix: '',
      body: 'hello',
      suffix: ',',
      bodyStart: 0,
      bodyEnd: 5,
    });
  });

  it('handles words with leading punctuation', () => {
    const result = extractWordBody('(hello');
    expect(result).toEqual({
      prefix: '(',
      body: 'hello',
      suffix: '',
      bodyStart: 1,
      bodyEnd: 6,
    });
  });

  it('handles words with both leading and trailing punctuation', () => {
    const result = extractWordBody('(hello),');
    expect(result).toEqual({
      prefix: '(',
      body: 'hello',
      suffix: '),',
      bodyStart: 1,
      bodyEnd: 6,
    });
  });

  it('handles smart quotes', () => {
    const result = extractWordBody('"hello"');
    expect(result).toEqual({
      prefix: '"',
      body: 'hello',
      suffix: '"',
      bodyStart: 1,
      bodyEnd: 6,
    });
  });

  it('handles em-dashes', () => {
    const result = extractWordBody('word—');
    expect(result).toEqual({
      prefix: '',
      body: 'word',
      suffix: '—',
      bodyStart: 0,
      bodyEnd: 4,
    });
  });

  it('handles ellipsis', () => {
    const result = extractWordBody('wait…');
    expect(result).toEqual({
      prefix: '',
      body: 'wait',
      suffix: '…',
      bodyStart: 0,
      bodyEnd: 4,
    });
  });
});

describe('splitTokenForOrp', () => {
  it('handles empty string', () => {
    expect(splitTokenForOrp('')).toEqual({ pre: '', orp: '', post: '' });
  });

  it('handles single char word', () => {
    expect(splitTokenForOrp('a')).toEqual({ pre: '', orp: 'a', post: '' });
  });

  it('handles two char word', () => {
    expect(splitTokenForOrp('an')).toEqual({ pre: '', orp: 'a', post: 'n' });
  });

  it('handles three char word - ORP at index 1', () => {
    expect(splitTokenForOrp('the')).toEqual({ pre: 't', orp: 'h', post: 'e' });
  });

  it('handles five char word - ORP at index 1', () => {
    expect(splitTokenForOrp('hello')).toEqual({ pre: 'h', orp: 'e', post: 'llo' });
  });

  it('handles six char word - ORP at index 2', () => {
    expect(splitTokenForOrp('worlds')).toEqual({ pre: 'wo', orp: 'r', post: 'lds' });
  });

  it('handles word with trailing punctuation', () => {
    // "hello," has body "hello" (5 chars), ORP at index 1
    expect(splitTokenForOrp('hello,')).toEqual({ pre: 'h', orp: 'e', post: 'llo,' });
  });

  it('handles word with leading punctuation', () => {
    // "(hello" has body "hello" (5 chars), ORP at index 1
    expect(splitTokenForOrp('(hello')).toEqual({ pre: '(h', orp: 'e', post: 'llo' });
  });

  it('handles word with both leading and trailing punctuation', () => {
    // "(hello)," has body "hello" (5 chars), ORP at index 1
    expect(splitTokenForOrp('(hello),')).toEqual({ pre: '(h', orp: 'e', post: 'llo),' });
  });

  it('handles pure punctuation tokens', () => {
    expect(splitTokenForOrp('...')).toEqual({ pre: '...', orp: '', post: '' });
  });

  it('handles long words', () => {
    // "international" has 13 chars, ORP at index 3
    expect(splitTokenForOrp('international')).toEqual({
      pre: 'int',
      orp: 'e',
      post: 'rnational',
    });
  });

  it('handles very long words', () => {
    // "extraordinarily" has 15 chars, ORP at index 4
    expect(splitTokenForOrp('extraordinarily')).toEqual({
      pre: 'extr',
      orp: 'a',
      post: 'ordinarily',
    });
  });
});

describe('getOrpCenterOffset', () => {
  it('returns 0.5 for empty string', () => {
    expect(getOrpCenterOffset('')).toBe(0.5);
  });

  it('returns centered value for single char', () => {
    // Single char "a", ORP at 0, center offset = (0 + 0.5) / 1 = 0.5
    expect(getOrpCenterOffset('a')).toBe(0.5);
  });

  it('calculates offset for simple word', () => {
    // "hello" (5 chars), ORP at index 1
    // offset = (1 + 0.5) / 5 = 0.3
    expect(getOrpCenterOffset('hello')).toBe(0.3);
  });

  it('accounts for leading punctuation', () => {
    // "(hello" (6 chars total), body "hello" (5 chars), ORP at body index 1
    // ORP position in token = 1 (prefix length) + 1 = 2
    // offset = (2 + 0.5) / 6 ≈ 0.4167
    expect(getOrpCenterOffset('(hello')).toBeCloseTo(0.4167, 3);
  });

  it('accounts for trailing punctuation', () => {
    // "hello," (6 chars total), body "hello" (5 chars), ORP at body index 1
    // ORP position in token = 0 (prefix length) + 1 = 1
    // offset = (1 + 0.5) / 6 = 0.25
    expect(getOrpCenterOffset('hello,')).toBe(0.25);
  });
});
