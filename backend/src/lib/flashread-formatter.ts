import { RenderedBlock } from './types';

const COMMON_HEADINGS = [
  'abstract',
  'introduction',
  'methods',
  'methodology',
  'results',
  'discussion',
  'conclusion',
  'references',
  'background',
  'related work',
  'implementation',
  'evaluation',
  'future work',
  'acknowledgments',
  'acknowledgements',
  'summary',
  'overview',
];

export function formatTextToBlocks(text: string): RenderedBlock[] {
  const blocks: RenderedBlock[] = [];
  
  // Split by blank lines (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    
    // Check if it's a heading
    if (isHeading(trimmed)) {
      blocks.push({
        type: 'heading',
        text: trimmed,
      });
    } else {
      // Regular paragraph
      blocks.push({
        type: 'p',
        text: trimmed,
      });
    }
  }

  return blocks;
}

function isHeading(text: string): boolean {
  // Remove common punctuation for checking
  const cleaned = text.replace(/[:.]/g, '').trim();
  
  // Check if ALL CAPS (at least 3 characters)
  if (cleaned.length >= 3 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    return true;
  }
  
  // Check if ends with colon
  if (text.endsWith(':')) {
    return true;
  }
  
  // Check if matches common section headings
  const lower = cleaned.toLowerCase();
  if (COMMON_HEADINGS.includes(lower)) {
    return true;
  }
  
  // Check if it's a short line (likely a heading)
  // Headings are typically < 60 characters and single line
  if (text.length < 60 && !text.includes('\n')) {
    // Check if it starts with a number (e.g., "1. Introduction")
    if (/^\d+\.?\s+[A-Z]/.test(text)) {
      return true;
    }
    
    // Check if it's title case (most words capitalized)
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    if (words.length > 1 && capitalizedWords.length / words.length > 0.6) {
      return true;
    }
  }
  
  return false;
}
