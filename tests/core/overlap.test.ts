import { describe, expect, it } from 'vitest';
import { findOverlaps } from '../../src/core/overlap';

const at = (hhmmss: string, date = '2026-10-29') => `${date}T${hhmmss}-07:00`;
const entry = (id: string, start: string, stop: string, source_id = 'tisupp') => ({
  id,
  start,
  stop,
  source_id,
});

// The wireframe case: 1:15–3:00 PM Client follow up on Oct 29.
const existing = [
  entry('a', at('13:15:00'), at('15:00:00')),
  entry('b', at('09:00:00'), at('10:00:00')),
];

describe('findOverlaps (SPEC §5, decision 0004)', () => {
  it('finds the wireframe overlap: 2:30–4:00 PM against 1:15–3:00 PM', () => {
    expect(findOverlaps({ start: at('14:30:00'), stop: at('16:00:00') }, existing)).toEqual([
      existing[0],
    ]);
  });

  it('allows back-to-back entries on either side', () => {
    expect(findOverlaps({ start: at('15:00:00'), stop: at('16:00:00') }, existing)).toEqual([]);
    expect(findOverlaps({ start: at('12:00:00'), stop: at('13:15:00') }, existing)).toEqual([]);
  });

  it('blocks one shared second', () => {
    expect(findOverlaps({ start: at('14:59:59'), stop: at('16:00:00') }, existing)).toHaveLength(1);
    expect(findOverlaps({ start: at('12:00:00'), stop: at('13:15:01') }, existing)).toHaveLength(1);
  });

  it('blocks identical, contained and containing ranges', () => {
    expect(findOverlaps({ start: at('13:15:00'), stop: at('15:00:00') }, existing)).toHaveLength(1);
    expect(findOverlaps({ start: at('13:30:00'), stop: at('14:00:00') }, existing)).toHaveLength(1);
    expect(findOverlaps({ start: at('08:00:00'), stop: at('16:00:00') }, existing)).toEqual([
      existing[1],
      existing[0],
    ]);
  });

  it('checks across funding sources', () => {
    const other = [entry('r', at('13:00:00'), at('14:00:00'), 'regen-general-operating')];
    expect(findOverlaps({ start: at('13:30:00'), stop: at('13:45:00') }, other)).toHaveLength(1);
  });

  it('ignores the entry being edited', () => {
    expect(findOverlaps({ start: at('13:00:00'), stop: at('15:30:00') }, existing, 'a')).toEqual(
      [],
    );
  });

  it('catches overlaps across midnight', () => {
    const late = [entry('n', at('23:00:00'), at('01:00:00', '2026-10-30'))];
    expect(
      findOverlaps(
        { start: at('00:30:00', '2026-10-30'), stop: at('02:00:00', '2026-10-30') },
        late,
      ),
    ).toHaveLength(1);
    expect(
      findOverlaps(
        { start: at('01:00:00', '2026-10-30'), stop: at('02:00:00', '2026-10-30') },
        late,
      ),
    ).toEqual([]);
  });

  it('compares instants when offsets differ', () => {
    // 20:30Z is 13:30 in Arizona, inside entry a.
    expect(
      findOverlaps(
        { start: '2026-10-29T20:30:00+00:00', stop: '2026-10-29T20:45:00+00:00' },
        existing,
      ),
    ).toHaveLength(1);
  });
});
