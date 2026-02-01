import { describe, it, expect } from 'vitest';
import { 
  tokenize, 
  blocksToText, 
  getWordCount, 
  isAbbreviation,
  detectNumberType,
  estimateSyllables,
  computeTokenComplexity,
  hasOpeningPunctuation,
  hasClosingPunctuation,
  hasDash,
  isCodeLike,
  hasMathSymbols,
  type RsvpToken 
} from '../rsvpTokenizer';

describe('tokenize', () => {
  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null as any)).toEqual([]);
    expect(tokenize(undefined as any)).toEqual([]);
  });

  it('tokenizes simple sentence', () => {
    const tokens = tokenize('Hello world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world');
  });

  it('preserves punctuation attached to words', () => {
    const tokens = tokenize('Hello, world!');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello,');
    expect(tokens[1].text).toBe('world!');
  });

  it('detects end punctuation correctly', () => {
    const tokens = tokenize('word, word. word? word! word; word:');
    expect(tokens[0].endPunctuation).toBe('comma');
    expect(tokens[1].endPunctuation).toBe('period');
    expect(tokens[2].endPunctuation).toBe('question');
    expect(tokens[3].endPunctuation).toBe('exclamation');
    expect(tokens[4].endPunctuation).toBe('semicolon');
    expect(tokens[5].endPunctuation).toBe('colon');
  });

  it('handles paragraph breaks', () => {
    const tokens = tokenize('First paragraph.\n\nSecond paragraph.');
    expect(tokens).toHaveLength(5); // 2 words + paragraph break + 2 words
    expect(tokens[2].isParagraphBreak).toBe(true);
    expect(tokens[2].text).toBe('');
  });

  it('normalizes single newlines to spaces', () => {
    const tokens = tokenize('Line one\nLine two');
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.text)).toEqual(['Line', 'one', 'Line', 'two']);
  });

  it('normalizes multiple spaces', () => {
    const tokens = tokenize('Hello    world');
    expect(tokens).toHaveLength(2);
  });

  it('handles em-dashes by splitting', () => {
    const tokens = tokenize('well—known');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('well—');
    expect(tokens[1].text).toBe('known');
  });

  it('handles smart quotes', () => {
    const tokens = tokenize('"Hello," she said.');
    expect(tokens[0].text).toBe('"Hello,"');
    expect(tokens[1].text).toBe('she');
    expect(tokens[2].text).toBe('said.');
  });

  it('detects short words', () => {
    const tokens = tokenize('a the of international');
    expect(tokens[0].isShortWord).toBe(true); // "a"
    expect(tokens[1].isShortWord).toBe(true); // "the"
    expect(tokens[2].isShortWord).toBe(true); // "of"
    expect(tokens[3].isShortWord).toBe(false); // "international"
  });

  it('assigns correct indices', () => {
    const tokens = tokenize('One two three');
    expect(tokens[0].index).toBe(0);
    expect(tokens[1].index).toBe(1);
    expect(tokens[2].index).toBe(2);
  });

  it('handles ellipsis', () => {
    const tokens = tokenize('Wait… What?');
    expect(tokens[0].text).toBe('Wait…');
    expect(tokens[0].endPunctuation).toBe('period'); // Ellipsis treated as period
  });

  it('handles parentheses', () => {
    const tokens = tokenize('This (word) here');
    expect(tokens[0].text).toBe('This');
    expect(tokens[1].text).toBe('(word)');
    expect(tokens[2].text).toBe('here');
  });

  it('handles complex punctuation combinations', () => {
    const tokens = tokenize('"What?!" he exclaimed.');
    expect(tokens[0].text).toBe('"What?!"');
    // Last character is closing quote, so endPunctuation is 'none'
    // (punctuation detection looks at the absolute last character)
    expect(tokens[0].endPunctuation).toBe('none');
  });
});

describe('blocksToText', () => {
  it('joins blocks with paragraph breaks', () => {
    const blocks = [
      { type: 'p', text: 'First paragraph.' },
      { type: 'p', text: 'Second paragraph.' },
    ];
    const text = blocksToText(blocks);
    expect(text).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('handles headings', () => {
    const blocks = [
      { type: 'heading', text: 'Title' },
      { type: 'p', text: 'Content.' },
    ];
    const text = blocksToText(blocks);
    expect(text).toBe('Title\n\nContent.');
  });

  it('handles empty blocks array', () => {
    expect(blocksToText([])).toBe('');
  });
});

describe('getWordCount', () => {
  it('counts words excluding paragraph breaks', () => {
    const tokens = tokenize('First para.\n\nSecond para.');
    expect(getWordCount(tokens)).toBe(4); // Excludes the paragraph break token
  });

  it('returns 0 for empty input', () => {
    expect(getWordCount([])).toBe(0);
  });

  it('counts correctly for simple text', () => {
    const tokens = tokenize('One two three four five');
    expect(getWordCount(tokens)).toBe(5);
  });
});

describe('tokenize edge cases', () => {
  it('handles text with only whitespace', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('\n\n\n')).toEqual([]);
    expect(tokenize('\t\t\t')).toEqual([]);
  });

  it('handles very long words', () => {
    const longWord = 'supercalifragilisticexpialidocious';
    const tokens = tokenize(longWord);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe(longWord);
    expect(tokens[0].isShortWord).toBe(false);
  });

  it('handles numbers', () => {
    const tokens = tokenize('The year 2024 was great.');
    expect(tokens).toHaveLength(5);
    expect(tokens[2].text).toBe('2024');
    expect(tokens[2].isShortWord).toBe(false); // Numbers are not in short word list
  });

  it('handles mixed content', () => {
    const tokens = tokenize('Hello! How are you? I am fine, thanks.');
    expect(tokens).toHaveLength(8);
    expect(tokens[0].endPunctuation).toBe('exclamation'); // Hello!
    expect(tokens[3].endPunctuation).toBe('question');    // you?
    expect(tokens[6].endPunctuation).toBe('comma');       // fine, (was index 5, corrected to 6)
    expect(tokens[7].endPunctuation).toBe('period');      // thanks.
  });

  it('handles code-like content', () => {
    const tokens = tokenize('Use console.log() to debug');
    expect(tokens).toHaveLength(4);
    expect(tokens[1].text).toBe('console.log()');
  });

  it('handles URLs gracefully', () => {
    const tokens = tokenize('Visit https://example.com for more');
    expect(tokens).toHaveLength(4);
    expect(tokens[1].text).toBe('https://example.com');
  });
});

describe('tokenize sanitization', () => {
  it('removes BOM at start of text', () => {
    const tokens = tokenize('\uFEFFHello world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
  });

  it('removes zero-width characters mid-word', () => {
    // Zero-width space (U+200B) embedded in word
    const tokens = tokenize('Hel\u200Blo world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
  });

  it('removes zero-width non-joiner and joiner', () => {
    const tokens = tokenize('te\u200Cst\u200Ding');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('testing');
  });

  it('removes control characters', () => {
    // Various control chars: NULL, BELL, BACKSPACE, etc.
    const tokens = tokenize('Hello\x00\x07\x08 world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world');
  });

  it('removes replacement character (encoding errors)', () => {
    const tokens = tokenize('Hello\uFFFD world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world');
  });

  it('removes private use area characters (OCR artifacts)', () => {
    // Private use area: U+E000 to U+F8FF
    const tokens = tokenize('\uE000Hello\uE001 \uF8FFworld');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world');
  });

  it('removes soft hyphens', () => {
    const tokens = tokenize('super\u00ADcalifragilistic');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('supercalifragilistic');
  });

  it('preserves curly quotes (handled by tokenizer)', () => {
    const tokens = tokenize('\u201CHello,\u201D she said.');
    expect(tokens[0].text).toBe('\u201CHello,\u201D');
    expect(tokens[1].text).toBe('she');
    expect(tokens[2].text).toBe('said.');
  });

  it('preserves single curly quotes (handled by tokenizer)', () => {
    const tokens = tokenize("It\u2019s a test");
    expect(tokens[0].text).toBe("It\u2019s");
  });

  it('normalizes exotic dashes to hyphen', () => {
    // Figure dash (U+2012) -> regular hyphen (no split)
    const tokens = tokenize('self\u2012aware');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('self-aware');
  });

  it('preserves en-dash splitting behavior', () => {
    // En-dash (U+2013) should still split words
    const tokens = tokenize('well\u2013known');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('well–');
    expect(tokens[1].text).toBe('known');
  });

  it('preserves em-dash splitting behavior', () => {
    // Em-dash (U+2014) should still split words
    const tokens = tokenize('wait\u2014stop');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('wait—');
    expect(tokens[1].text).toBe('stop');
  });

  it('normalizes horizontal bar to em-dash', () => {
    // Horizontal bar (U+2015) -> em-dash (splits words)
    const tokens = tokenize('wait\u2015stop');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('wait—');
    expect(tokens[1].text).toBe('stop');
  });

  it('handles text with multiple invisible characters', () => {
    const messyText = '\uFEFF\u200BHello\u200C \uFFFDworld\uE000!';
    const tokens = tokenize(messyText);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world!');
  });

  it('handles word boundary zero-width space', () => {
    // Zero-width space used as word boundary (common OCR issue)
    const tokens = tokenize('word1\u200Bword2');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('word1word2');
  });

  it('preserves normal text unchanged', () => {
    const normalText = 'The quick brown fox jumps over the lazy dog.';
    const tokens = tokenize(normalText);
    expect(tokens).toHaveLength(9);
    expect(tokens.map((t) => t.text).join(' ')).toBe(normalText);
  });

  it('rejoins hyphenated words split across lines', () => {
    const tokens = tokenize('Katz-\nBassett is here');
    // "Katz-Bassett" (12 chars) exceeds threshold, so it gets split
    expect(tokens).toHaveLength(4);
    expect(tokens[0].text).toBe('Katz-');
    expect(tokens[1].text).toBe('Bassett');
    expect(tokens[2].text).toBe('is');
    expect(tokens[3].text).toBe('here');
  });

  it('handles hyphenated line breaks with extra whitespace', () => {
    const tokens = tokenize('Katz-  \n  Bassett');
    // "Katz-Bassett" (12 chars) exceeds threshold, so it gets split
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Katz-');
    expect(tokens[1].text).toBe('Bassett');
  });
});

describe('tokenize hyphenated words', () => {
  it('keeps short hyphenated words together (≤10 chars)', () => {
    // "self-aware" is exactly 10 chars, should stay together
    const tokens = tokenize('self-aware');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('self-aware');
  });

  it('keeps well-known together (10 chars)', () => {
    const tokens = tokenize('well-known');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe('well-known');
  });

  it('splits long hyphenated words (>10 chars)', () => {
    // "application-specific" is 20 chars, should split
    const tokens = tokenize('application-specific');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('application-');
    expect(tokens[1].text).toBe('specific');
  });

  it('splits multi-hyphenated long words', () => {
    // "first-come-first-served" is 23 chars
    const tokens = tokenize('first-come-first-served');
    expect(tokens).toHaveLength(4);
    expect(tokens[0].text).toBe('first-');
    expect(tokens[1].text).toBe('come-');
    expect(tokens[2].text).toBe('first-');
    expect(tokens[3].text).toBe('served');
  });

  it('splits hyphenated words with quotes', () => {
    // '"application-specific"' with smart quotes
    const tokens = tokenize('"application-specific"');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('"application-');
    expect(tokens[1].text).toBe('specific"');
  });

  it('handles hyphenated word in sentence context', () => {
    const tokens = tokenize('This is application-specific code.');
    expect(tokens).toHaveLength(5);
    expect(tokens[0].text).toBe('This');
    expect(tokens[1].text).toBe('is');
    expect(tokens[2].text).toBe('application-');
    expect(tokens[3].text).toBe('specific');
    expect(tokens[4].text).toBe('code.');
  });

  it('preserves indices after hyphen splits', () => {
    const tokens = tokenize('This application-specific code works');
    expect(tokens[0].index).toBe(0); // This
    expect(tokens[1].index).toBe(1); // application-
    expect(tokens[2].index).toBe(2); // specific
    expect(tokens[3].index).toBe(3); // code
    expect(tokens[4].index).toBe(4); // works
  });

  it('correctly calculates word length for split tokens', () => {
    const tokens = tokenize('application-specific');
    // "application-" has word body "application" (11 chars)
    expect(tokens[0].wordLength).toBe(11);
    // "specific" has word body "specific" (8 chars)
    expect(tokens[1].wordLength).toBe(8);
  });
});

describe('tokenize phrase boundaries', () => {
  it('marks token before "and" as phrase boundary', () => {
    const tokens = tokenize('The dog and cat');
    // "dog" should be marked as phrase boundary (before "and")
    expect(tokens[1].text).toBe('dog');
    expect(tokens[1].isPhraseBoundary).toBe(true);
    // "and" itself is not a phrase boundary
    expect(tokens[2].text).toBe('and');
    expect(tokens[2].isPhraseBoundary).toBe(false);
  });

  it('marks token before "but" as phrase boundary', () => {
    const tokens = tokenize('I tried but failed');
    expect(tokens[1].text).toBe('tried');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('marks token before "because" as phrase boundary', () => {
    const tokens = tokenize('I left because it was late');
    expect(tokens[1].text).toBe('left');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('marks token before "however" as phrase boundary', () => {
    const tokens = tokenize('It works however slowly');
    expect(tokens[1].text).toBe('works');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('marks token before "which" as phrase boundary', () => {
    const tokens = tokenize('The book which I read');
    expect(tokens[1].text).toBe('book');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('does not mark phrase boundary if punctuation present', () => {
    // If there's already punctuation, don't also mark as phrase boundary
    const tokens = tokenize('Hello, and goodbye');
    expect(tokens[0].text).toBe('Hello,');
    expect(tokens[0].endPunctuation).toBe('comma');
    expect(tokens[0].isPhraseBoundary).toBe(false); // Punctuation takes precedence
  });

  it('handles multiple conjunctions in sequence', () => {
    const tokens = tokenize('cats and dogs and birds');
    expect(tokens[0].text).toBe('cats');
    expect(tokens[0].isPhraseBoundary).toBe(true); // before first "and"
    expect(tokens[2].text).toBe('dogs');
    expect(tokens[2].isPhraseBoundary).toBe(true); // before second "and"
  });

  it('marks phrase boundaries with subordinating conjunctions', () => {
    const tokens = tokenize('I waited until dawn');
    expect(tokens[1].text).toBe('waited');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('handles "that" as relative pronoun', () => {
    const tokens = tokenize('The thing that matters');
    expect(tokens[1].text).toBe('thing');
    expect(tokens[1].isPhraseBoundary).toBe(true);
  });

  it('handles transition words', () => {
    const tokens = tokenize('First therefore second');
    expect(tokens[0].text).toBe('First');
    expect(tokens[0].isPhraseBoundary).toBe(true); // before "therefore"
  });
});

describe('tokenize wordsSinceLastPause', () => {
  it('starts at 0 for first word', () => {
    const tokens = tokenize('Hello world');
    expect(tokens[0].wordsSinceLastPause).toBe(0);
  });

  it('increments for consecutive words without pause', () => {
    const tokens = tokenize('The quick brown fox');
    expect(tokens[0].wordsSinceLastPause).toBe(0);
    expect(tokens[1].wordsSinceLastPause).toBe(1);
    expect(tokens[2].wordsSinceLastPause).toBe(2);
    expect(tokens[3].wordsSinceLastPause).toBe(3);
  });

  it('resets after punctuation', () => {
    const tokens = tokenize('Hello, world today');
    expect(tokens[0].wordsSinceLastPause).toBe(0); // "Hello,"
    expect(tokens[1].wordsSinceLastPause).toBe(0); // "world" - reset after comma
    expect(tokens[2].wordsSinceLastPause).toBe(1); // "today"
  });

  it('resets after phrase boundary', () => {
    const tokens = tokenize('The dog and the cat');
    expect(tokens[0].wordsSinceLastPause).toBe(0); // "The"
    expect(tokens[1].wordsSinceLastPause).toBe(1); // "dog" (phrase boundary)
    expect(tokens[2].wordsSinceLastPause).toBe(0); // "and" - reset after boundary
    expect(tokens[3].wordsSinceLastPause).toBe(1); // "the"
    expect(tokens[4].wordsSinceLastPause).toBe(2); // "cat"
  });

  it('resets at paragraph start', () => {
    const tokens = tokenize('First paragraph.\n\nSecond paragraph.');
    // After paragraph break, counter resets
    expect(tokens[3].text).toBe('Second');
    expect(tokens[3].wordsSinceLastPause).toBe(0);
  });

  it('tracks long runs without pause', () => {
    const tokens = tokenize('one two three four five six seven eight');
    expect(tokens[7].wordsSinceLastPause).toBe(7); // "eight" after 7 words
  });
});

// ==================== NEW CADENCE MODEL TESTS ====================

describe('isAbbreviation', () => {
  it('detects common title abbreviations', () => {
    expect(isAbbreviation('Dr.')).toBe(true);
    expect(isAbbreviation('Mr.')).toBe(true);
    expect(isAbbreviation('Mrs.')).toBe(true);
    expect(isAbbreviation('Prof.')).toBe(true);
    expect(isAbbreviation('Jr.')).toBe(true);
    expect(isAbbreviation('Sr.')).toBe(true);
  });

  it('detects Latin abbreviations', () => {
    expect(isAbbreviation('e.g.')).toBe(true);
    expect(isAbbreviation('i.e.')).toBe(true);
    expect(isAbbreviation('etc.')).toBe(true);
    expect(isAbbreviation('vs.')).toBe(true);
    expect(isAbbreviation('cf.')).toBe(true);
  });

  it('detects initialisms (U.S., A.M., Ph.D.)', () => {
    expect(isAbbreviation('U.S.')).toBe(true);
    expect(isAbbreviation('A.M.')).toBe(true);
    expect(isAbbreviation('Ph.D.')).toBe(true);
    expect(isAbbreviation('N.A.S.A.')).toBe(true);
  });

  it('detects single initials (J. in J. Smith)', () => {
    expect(isAbbreviation('J.')).toBe(true);
    expect(isAbbreviation('A.')).toBe(true);
  });

  it('does not flag regular words ending with period', () => {
    expect(isAbbreviation('Hello.')).toBe(false);
    expect(isAbbreviation('world.')).toBe(false);
    expect(isAbbreviation('sentence.')).toBe(false);
  });

  it('handles abbreviations with commas', () => {
    expect(isAbbreviation('Dr.,')).toBe(true);
    expect(isAbbreviation('etc.,')).toBe(true);
  });
});

describe('detectNumberType', () => {
  it('detects decimal numbers', () => {
    expect(detectNumberType('3.14')).toBe('decimal');
    expect(detectNumberType('3.14159')).toBe('decimal');
    expect(detectNumberType('1,000')).toBe('decimal');
    expect(detectNumberType('1,234,567')).toBe('decimal');
  });

  it('detects ranges', () => {
    expect(detectNumberType('10-12')).toBe('range');
    expect(detectNumberType('10–12')).toBe('range'); // en-dash
    expect(detectNumberType('pp. 10-15')).toBe('range');
  });

  it('detects percentages', () => {
    expect(detectNumberType('50%')).toBe('percent');
    expect(detectNumberType('3.5%')).toBe('percent');
    expect(detectNumberType('100%')).toBe('percent');
  });

  it('detects currency', () => {
    expect(detectNumberType('$19.99')).toBe('currency');
    expect(detectNumberType('€50')).toBe('currency');
    expect(detectNumberType('£100.00')).toBe('currency');
  });

  it('detects units', () => {
    expect(detectNumberType('12kg')).toBe('unit');
    expect(detectNumberType('37°C')).toBe('unit');
    expect(detectNumberType('100ml')).toBe('unit');
    expect(detectNumberType('50GB')).toBe('unit');
  });

  it('detects bracket citations', () => {
    expect(detectNumberType('[12]')).toBe('citation');
    expect(detectNumberType('[1-3]')).toBe('citation');
    expect(detectNumberType('[Smith2020]')).toBe('citation');
  });

  it('detects plain numbers', () => {
    expect(detectNumberType('123')).toBe('plain');
    expect(detectNumberType('2024')).toBe('plain');
  });

  it('returns null for non-numbers', () => {
    expect(detectNumberType('hello')).toBe(null);
    expect(detectNumberType('world')).toBe(null);
  });
});

describe('estimateSyllables', () => {
  it('counts single-syllable words', () => {
    expect(estimateSyllables('cat')).toBe(1);
    expect(estimateSyllables('the')).toBe(1);
    expect(estimateSyllables('dog')).toBe(1);
    expect(estimateSyllables('run')).toBe(1);
  });

  it('counts two-syllable words', () => {
    expect(estimateSyllables('hello')).toBe(2);
    expect(estimateSyllables('happy')).toBe(2);
    expect(estimateSyllables('water')).toBe(2);
  });

  it('counts multi-syllable words', () => {
    expect(estimateSyllables('elephant')).toBe(3);
    expect(estimateSyllables('beautiful')).toBe(3);
    expect(estimateSyllables('information')).toBe(4);
    expect(estimateSyllables('university')).toBe(5);
  });

  it('handles silent e', () => {
    expect(estimateSyllables('make')).toBe(1);
    expect(estimateSyllables('time')).toBe(1);
    expect(estimateSyllables('home')).toBe(1);
  });

  it('handles words with punctuation', () => {
    expect(estimateSyllables('hello,')).toBe(2);
    expect(estimateSyllables('"world"')).toBe(1);
  });

  it('caps at 6 syllables', () => {
    expect(estimateSyllables('supercalifragilisticexpialidocious')).toBeLessThanOrEqual(6);
  });
});

describe('computeTokenComplexity', () => {
  it('returns low complexity for common words', () => {
    expect(computeTokenComplexity('the')).toBeLessThan(0.3);
    expect(computeTokenComplexity('and')).toBeLessThan(0.3);
    expect(computeTokenComplexity('is')).toBeLessThan(0.3);
  });

  it('returns higher complexity for uncommon words', () => {
    expect(computeTokenComplexity('syzygy')).toBeGreaterThan(0.3);
    expect(computeTokenComplexity('ephemeral')).toBeGreaterThan(0.2);
  });

  it('increases complexity for long words', () => {
    const shortWordComplexity = computeTokenComplexity('run');
    const longWordComplexity = computeTokenComplexity('internationalization');
    expect(longWordComplexity).toBeGreaterThan(shortWordComplexity);
  });

  it('returns value between 0 and 1', () => {
    expect(computeTokenComplexity('test')).toBeGreaterThanOrEqual(0);
    expect(computeTokenComplexity('test')).toBeLessThanOrEqual(1);
    expect(computeTokenComplexity('antidisestablishmentarianism')).toBeLessThanOrEqual(1);
  });
});

describe('punctuation detection helpers', () => {
  it('detects opening punctuation', () => {
    expect(hasOpeningPunctuation('"hello')).toBe(true);
    expect(hasOpeningPunctuation('(word)')).toBe(true);
    expect(hasOpeningPunctuation('[citation]')).toBe(true);
    expect(hasOpeningPunctuation('hello')).toBe(false);
  });

  it('detects closing punctuation', () => {
    expect(hasClosingPunctuation('hello"')).toBe(true);
    expect(hasClosingPunctuation('(word)')).toBe(true);
    expect(hasClosingPunctuation('[citation]')).toBe(true);
    expect(hasClosingPunctuation('hello')).toBe(false);
  });

  it('detects dashes', () => {
    expect(hasDash('well—known')).toBe(true);
    expect(hasDash('10–12')).toBe(true);
    expect(hasDash('hello')).toBe(false);
  });

  it('detects code-like tokens', () => {
    expect(isCodeLike('camelCase')).toBe(true);
    expect(isCodeLike('snake_case')).toBe(true);
    expect(isCodeLike('PascalCase')).toBe(true);
    expect(isCodeLike('hello')).toBe(false);
  });

  it('detects math symbols', () => {
    expect(hasMathSymbols('∑')).toBe(true);
    expect(hasMathSymbols('α + β')).toBe(true);
    expect(hasMathSymbols('hello')).toBe(false);
  });
});

describe('tokenize with new cadence fields', () => {
  it('sets abbreviation flag correctly', () => {
    const tokens = tokenize('Dr. Smith works at MIT.');
    expect(tokens[0].isAbbreviation).toBe(true);
    expect(tokens[0].endPunctuation).toBe('none'); // Not treated as sentence end
    expect(tokens[1].isAbbreviation).toBe(false);
  });

  it('does not treat abbreviations as sentence ends', () => {
    const tokens = tokenize('Dr. Smith is here.');
    // "Dr." should NOT have period endPunctuation
    expect(tokens[0].endPunctuation).toBe('none');
    expect(tokens[0].isSentenceEnd).toBe(false);
    // "here." should be sentence end
    expect(tokens[3].endPunctuation).toBe('period');
    expect(tokens[3].isSentenceEnd).toBe(true);
  });

  it('handles U.S. correctly', () => {
    const tokens = tokenize('The U.S. is large.');
    // "U.S." should NOT be treated as sentence end
    expect(tokens[1].isAbbreviation).toBe(true);
    expect(tokens[1].endPunctuation).toBe('none');
    expect(tokens[1].isSentenceEnd).toBe(false);
  });

  it('sets number flags correctly', () => {
    const tokens = tokenize('The price is $19.99 today.');
    const priceToken = tokens.find(t => t.text === '$19.99');
    expect(priceToken?.isNumber).toBe(true);
    expect(priceToken?.numberType).toBe('currency');
  });

  it('sets citation flag correctly', () => {
    const tokens = tokenize('See reference [12] for details.');
    const citationToken = tokens.find(t => t.text === '[12]');
    expect(citationToken?.isCitation).toBe(true);
  });

  it('sets syllable count correctly', () => {
    const tokens = tokenize('The elephant walked slowly.');
    const elephantToken = tokens.find(t => t.text === 'elephant');
    expect(elephantToken?.estimatedSyllables).toBe(3);
  });

  it('sets complexity score correctly', () => {
    const tokens = tokenize('The syzygy occurred.');
    const commonToken = tokens.find(t => t.text === 'The');
    const rareToken = tokens.find(t => t.text === 'syzygy');
    expect(commonToken?.tokenComplexity).toBeLessThan(rareToken?.tokenComplexity || 0);
  });

  it('sets boundary type correctly', () => {
    const tokens = tokenize('Hello, world. How are you?');
    expect(tokens[0].boundaryType).toBe('clause'); // comma
    expect(tokens[1].boundaryType).toBe('sentence'); // period
    expect(tokens[4].boundaryType).toBe('sentence'); // question
  });

  it('sets dash flag correctly', () => {
    const tokens = tokenize('The well—known author');
    const dashToken = tokens.find(t => t.text === 'well—');
    expect(dashToken?.hasDash).toBe(true);
  });

  it('sets opening/closing punctuation flags', () => {
    const tokens = tokenize('She said "hello" quietly');
    const openQuoteToken = tokens.find(t => t.text === '"hello"');
    expect(openQuoteToken?.hasOpeningPunctuation).toBe(true);
    expect(openQuoteToken?.hasClosingPunctuation).toBe(true);
  });

  it('handles decimal numbers without false sentence end', () => {
    const tokens = tokenize('Pi is 3.14159 approximately.');
    const piToken = tokens.find(t => t.text === '3.14159');
    expect(piToken?.isNumber).toBe(true);
    expect(piToken?.endPunctuation).toBe('none');
    expect(piToken?.isSentenceEnd).toBe(false);
  });

  it('paragraph breaks have correct boundary type', () => {
    const tokens = tokenize('First.\n\nSecond.');
    const paragraphBreak = tokens.find(t => t.isParagraphBreak);
    expect(paragraphBreak?.boundaryType).toBe('paragraph');
  });
});
