import { diffWords, Change } from 'diff';

export type DiffPart = {
  value: string;
  type: 'added' | 'removed' | 'unchanged';
};

/**
 * Compares two sentences and returns an array of diff parts
 * for inline highlighting of changes.
 *
 * @param original - The original sentence (with errors)
 * @param corrected - The corrected sentence
 * @returns Array of diff parts with type indicators
 */
export function diffSentences(original: string, corrected: string): DiffPart[] {
  const changes: Change[] = diffWords(original, corrected);

  return changes.map((part) => ({
    value: part.value,
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
  }));
}

/**
 * Renders diff parts for the original sentence (showing removed/unchanged)
 */
export function getOriginalDiffParts(diffs: DiffPart[]): DiffPart[] {
  return diffs.filter((part) => part.type !== 'added');
}

/**
 * Renders diff parts for the corrected sentence (showing added/unchanged)
 */
export function getCorrectedDiffParts(diffs: DiffPart[]): DiffPart[] {
  return diffs.filter((part) => part.type !== 'removed');
}

/**
 * Grammar error type tooltips
 */
export const grammarTooltips: Record<string, string> = {
  article: 'Missing or extra article (a, an, the)',
  'verb-agreement': 'Subject and verb must agree in number',
  'subject-verb-agreement': 'Subject and verb must agree in number',
  preposition: 'Incorrect or missing preposition',
  conjunction: 'Missing or incorrect conjunction (and, or, but)',
  tense: 'Incorrect verb tense',
  'word-order': 'Incorrect word order in sentence',
  plural: 'Incorrect singular/plural form',
  pronoun: 'Incorrect pronoun usage',
  modifier: 'Misplaced or incorrect modifier',
  fragment: 'Incomplete sentence',
  'run-on': 'Two sentences incorrectly joined',
};

/**
 * Get tooltip text for an error type
 */
export function getErrorTooltip(errorType: string): string {
  return grammarTooltips[errorType.toLowerCase()] || 'Grammar error';
}

/**
 * Determine severity color classes
 */
export function getSeverityClasses(severity: 'minor' | 'major'): {
  badge: string;
  text: string;
} {
  if (severity === 'major') {
    return {
      badge: 'bg-red-500/30 text-red-300 border-red-500/50',
      text: 'text-red-300',
    };
  }
  return {
    badge: 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50',
    text: 'text-yellow-300',
  };
}

/**
 * Get color classes for error type chips
 */
export function getErrorTypeClasses(errorType: string): string {
  const lowerType = errorType.toLowerCase();

  if (lowerType.includes('article') || lowerType.includes('preposition')) {
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }
  if (lowerType.includes('verb') || lowerType.includes('tense')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  }
  if (lowerType.includes('plural') || lowerType.includes('pronoun')) {
    return 'bg-green-500/20 text-green-300 border-green-500/40';
  }

  return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
}
