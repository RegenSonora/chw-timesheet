// Overlap rule (SPEC §5, decision 0004): compared on raw times across all funding sources.
import { parseIso } from './time';

export interface TimeRange {
  start: string;
  stop: string;
}

/**
 * Entries whose raw times overlap the candidate, earliest first. Ranges are half-open,
 * so an entry may start the exact second another ends. Pass the id of the entry being
 * edited so it does not clash with itself.
 */
export function findOverlaps<T extends TimeRange & { id: string }>(
  candidate: TimeRange,
  entries: readonly T[],
  excludeId?: string,
): T[] {
  const a0 = parseIso(candidate.start).epochMs;
  const a1 = parseIso(candidate.stop).epochMs;
  return entries
    .filter((e) => e.id !== excludeId)
    .map((e) => ({ e, b0: parseIso(e.start).epochMs, b1: parseIso(e.stop).epochMs }))
    .filter(({ b0, b1 }) => a0 < b1 && b0 < a1)
    .sort((x, y) => x.b0 - y.b0)
    .map(({ e }) => e);
}
