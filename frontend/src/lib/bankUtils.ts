/**
 * Shared utility functions for DTP Bank and Recommendations Bank features.
 *
 * All functions are pure (no side effects) and use generics where appropriate.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaginationResult<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
}

export interface RecommendationEntry {
  recommendation: string;
  rationale: string;
}

// ─── Search & Pagination ─────────────────────────────────────────────────────

/**
 * Filter items by title using case-insensitive substring matching.
 * Works on any object that has a `title: string` property.
 */
export function filterByTitle<T extends { title: string }>(
  items: T[],
  searchQuery: string
): T[] {
  const query = searchQuery.toLowerCase();
  if (query === '') return items;
  return items.filter((item) => item.title.toLowerCase().includes(query));
}

/**
 * Paginate a list of items. Page is 1-indexed.
 * Returns the slice for the requested page along with total pages and current page.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginationResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return {
    items: items.slice(startIndex, endIndex),
    totalPages,
    currentPage,
  };
}

// ─── Submission Validation ───────────────────────────────────────────────────

/**
 * Validate a DTP submission. Returns false if all entries are empty or whitespace-only.
 * A valid submission must have at least one non-empty, non-whitespace entry.
 */
export function validateDTPSubmission(entries: string[]): boolean {
  return entries.some((entry) => entry.trim().length > 0);
}

/**
 * Validate a Recommendation submission. Returns false if all recommendation fields
 * are empty or whitespace-only. Rationale is not considered for validation —
 * at least one non-empty recommendation is required.
 */
export function validateRecommendationSubmission(
  entries: RecommendationEntry[]
): boolean {
  return entries.some((entry) => entry.recommendation.trim().length > 0);
}

// ─── Dynamic List Management ─────────────────────────────────────────────────

/**
 * Add a new empty entry to a list of strings (DTP entries).
 * Returns a new array with one additional empty string appended.
 */
export function addListEntry(list: string[]): string[];
/**
 * Add a new empty entry to a list of recommendation entries.
 * Returns a new array with one additional empty `{recommendation: '', rationale: ''}` appended.
 */
export function addListEntry(list: RecommendationEntry[]): RecommendationEntry[];
/**
 * Implementation: detects the list type and appends the appropriate empty entry.
 */
export function addListEntry(
  list: string[] | RecommendationEntry[]
): string[] | RecommendationEntry[] {
  if (list.length === 0) {
    // Default to string list if empty — caller should provide typed empty array
    return [''];
  }
  if (typeof list[0] === 'string') {
    return [...(list as string[]), ''];
  }
  return [...(list as RecommendationEntry[]), { recommendation: '', rationale: '' }];
}

/**
 * Remove an entry at the given index from a list.
 * Returns a new array without the entry at the specified index.
 */
export function removeListEntry<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}
