/**
 * ORP (Optimal Recognition Point) calculation for RSVP reading.
 * 
 * The ORP is the position in a word where the eye should fixate for
 * optimal recognition. Research suggests this is typically slightly
 * left of center for most words.
 */

/**
 * Calculate the ORP index for a given word length.
 * Research-backed algorithm for optimal recognition point placement.
 * @param length - Length of the word (excluding punctuation)
 * @returns The index (0-based) of the ORP character
 */
export function getOrpIndex(length: number): number {
  if (length <= 0) return 0;
  if (length <= 2) return 0;    // "a", "an" -> 1st char (index 0)
  if (length <= 5) return 1;    // "the", "hello" -> 2nd char (index 1)
  if (length <= 9) return 2;    // "worlds", "reading" -> 3rd char (index 2)
  if (length <= 13) return 3;   // "information" -> 4th char (index 3)
  return 4;                      // "extraordinarily" -> 5th char (index 4)
}

/**
 * Extracts the "word body" from a token, stripping leading and trailing punctuation.
 * Returns the indices where the actual word starts and ends within the token.
 */
export function extractWordBody(token: string): {
  prefix: string;
  body: string;
  suffix: string;
  bodyStart: number;
  bodyEnd: number;
} {
  // Leading punctuation pattern
  const leadingPunctuationRegex = /^[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•]+/;
  // Trailing punctuation pattern
  const trailingPunctuationRegex = /[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•.,!?;:]+$/;
  
  let prefix = '';
  let suffix = '';
  let body = token;
  
  const leadingMatch = body.match(leadingPunctuationRegex);
  if (leadingMatch) {
    prefix = leadingMatch[0];
    body = body.slice(prefix.length);
  }
  
  const trailingMatch = body.match(trailingPunctuationRegex);
  if (trailingMatch) {
    suffix = trailingMatch[0];
    body = body.slice(0, -suffix.length);
  }
  
  return {
    prefix,
    body,
    suffix,
    bodyStart: prefix.length,
    bodyEnd: prefix.length + body.length,
  };
}

/**
 * Split a token into three parts for rendering with ORP highlight.
 * @param token - The full token (may include punctuation)
 * @returns Object with pre (before ORP), orp (the ORP character), and post (after ORP)
 */
export function splitTokenForOrp(token: string): {
  pre: string;
  orp: string;
  post: string;
} {
  if (!token || token.length === 0) {
    return { pre: '', orp: '', post: '' };
  }
  
  const { prefix, body, suffix } = extractWordBody(token);
  
  // Handle empty body (pure punctuation tokens)
  if (body.length === 0) {
    // For pure punctuation, just show it all without highlight
    return { pre: token, orp: '', post: '' };
  }
  
  const orpIndex = getOrpIndex(body.length);
  const safeOrpIndex = Math.min(orpIndex, body.length - 1);
  
  // Split the body around the ORP
  const bodyPre = body.slice(0, safeOrpIndex);
  const orpChar = body[safeOrpIndex];
  const bodyPost = body.slice(safeOrpIndex + 1);
  
  return {
    pre: prefix + bodyPre,
    orp: orpChar,
    post: bodyPost + suffix,
  };
}

/**
 * Calculate the horizontal offset (as a fraction of word width) needed
 * to center the ORP character at the visual center.
 * 
 * @param token - The token to calculate offset for
 * @returns A value from 0 to 1 representing how far left the word should shift
 */
export function getOrpCenterOffset(token: string): number {
  if (!token || token.length === 0) return 0.5;
  
  const { prefix, body, suffix } = extractWordBody(token);
  
  if (body.length === 0) return 0.5;
  
  const orpIndex = getOrpIndex(body.length);
  const safeOrpIndex = Math.min(orpIndex, body.length - 1);
  
  // Position within the full token
  const orpPositionInToken = prefix.length + safeOrpIndex;
  const totalLength = token.length;
  
  // Return the fraction of the token that precedes the ORP center
  // Adding 0.5 to center on the middle of the character
  return (orpPositionInToken + 0.5) / totalLength;
}
