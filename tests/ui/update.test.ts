import { describe, expect, it } from 'vitest';
import { emptyAppState, type EntryDraft } from '../../src/storage';
import { isMidEntry } from '../../src/ui/update';

describe('mid-entry (decision 0014)', () => {
  it('is not mid-entry with no draft and no timer', () => {
    expect(isMidEntry(emptyAppState())).toBe(false);
  });

  it('a running timer is mid-entry', () => {
    expect(
      isMidEntry({
        ...emptyAppState(),
        running_timer: { start: '2026-11-01T09:00:00-07:00', source_id: 'tisupp' },
      }),
    ).toBe(true);
  });

  it('a saved draft is mid-entry', () => {
    const draft = { kind: 'entry' } as EntryDraft;
    expect(isMidEntry({ ...emptyAppState(), draft })).toBe(true);
  });
});
