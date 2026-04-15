/**
 * Debrief Parser Utility
 *
 * Consolidated module for parsing raw AI debrief JSON responses.
 * Previously duplicated across studentService.ts and StudentChatPage.tsx.
 */

/**
 * Recursively unwrap a value that may be a JSON string (possibly multi-encoded)
 * or an object. Returns a plain object or null.
 */
export function deepParseJson(value: unknown): Record<string, any> | null {
  const MAX_DEPTH = 5;
  let current: unknown = value;
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (current !== null && typeof current === 'object' && !Array.isArray(current)) {
      return current as Record<string, any>;
    }
    if (typeof current !== 'string') return null;
    const str = (current as string).trim();
    if (!str) return null;

    // Try direct JSON.parse
    try {
      current = JSON.parse(str);
      continue;
    } catch { /* fall through to brace extraction */ }

    // Try extracting the outermost { ... } from the string (handles LLM preamble text)
    const firstBrace = str.indexOf('{');
    if (firstBrace === -1) return null;

    // Find the matching closing brace by counting depth
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastBrace = -1;
    for (let j = firstBrace; j < str.length; j++) {
      const ch = str[j];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) { lastBrace = j; break; } }
    }
    if (lastBrace === -1) return null;

    try {
      current = JSON.parse(str.slice(firstBrace, lastBrace + 1));
      continue;
    } catch { return null; }
  }
  return null;
}

/**
 * Attempts to extract structured debrief data from a raw JSON string.
 * Handles both complete and truncated JSON from the LLM.
 * Tries direct parse first, then progressively repairs truncated JSON
 * by closing open brackets/braces.
 */
export function extractDebriefFromRawJson(raw: string): Record<string, any> | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && obj.summary) return obj;
  } catch { /* continue to repair attempts */ }

  const firstBrace = raw.indexOf('{');
  if (firstBrace === -1) return null;

  let jsonStr = raw.slice(firstBrace);

  // Try progressively closing the JSON to make it parseable
  const closers = ['"}', '"]', '}]', '}}', '}'];
  for (let attempt = 0; attempt < 8; attempt++) {
    for (const closer of closers) {
      try {
        const repaired = jsonStr + closer.repeat(attempt + 1);
        const obj = JSON.parse(repaired);
        if (obj && typeof obj === 'object' && obj.summary) return obj;
      } catch { /* try next */ }
    }
    // Specific common truncation repairs
    try {
      const obj = JSON.parse(jsonStr + ']}]}');
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* try next */ }
    try {
      const obj = JSON.parse(jsonStr + '"}]}');
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* try next */ }
  }

  // Last resort: truncate to the last complete key-value and close
  const lastCompleteComma = jsonStr.lastIndexOf('",');
  const lastCompleteBracket = jsonStr.lastIndexOf('],');
  const lastCompleteBrace = jsonStr.lastIndexOf('},');
  const cutPoint = Math.max(lastCompleteComma, lastCompleteBracket, lastCompleteBrace);
  
  if (cutPoint > 0) {
    const truncated = jsonStr.slice(0, cutPoint + 1);
    let openBraces = 0, openBrackets = 0, inString = false, escaped = false;
    for (const ch of truncated) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    const suffix = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    try {
      const obj = JSON.parse(truncated + suffix);
      if (obj && typeof obj === 'object' && obj.summary) return obj;
    } catch { /* give up */ }
  }

  return null;
}
