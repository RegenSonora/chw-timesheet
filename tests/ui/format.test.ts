import { describe, expect, it } from 'vitest';
import {
  clockLabel,
  dateLabel,
  durationLabel,
  hoursLabel,
  localDateTime,
  plural,
  shortDateLabel,
  timeLabel,
  timeRangeLabel,
  versionLabel,
} from '../../src/ui/format';

const AZ = 'America/Phoenix';

describe('display formats (wireframes)', () => {
  it('hours', () => {
    expect(hoursLabel(6)).toBe('1.5 h');
    expect(hoursLabel(7)).toBe('1.75 h');
    expect(hoursLabel(37)).toBe('9.25 h');
    expect(hoursLabel(8)).toBe('2 h');
    expect(hoursLabel(1)).toBe('0.25 h');
    expect(hoursLabel(40)).toBe('10 h');
  });

  it('dates', () => {
    expect(dateLabel('2026-10-30')).toBe('Fri, Oct 30');
    expect(shortDateLabel('2026-10-29')).toBe('Oct 29');
  });

  it('times in the phone time zone', () => {
    expect(timeLabel('2026-10-30T09:12:04-07:00', AZ)).toBe('9:12 AM');
    expect(timeRangeLabel('2026-10-30T09:12:04-07:00', '2026-10-30T10:37:10-07:00', AZ)).toBe(
      '9:12–10:37 AM',
    );
    expect(timeRangeLabel('2026-10-29T11:30:00-07:00', '2026-10-29T13:00:00-07:00', AZ)).toBe(
      '11:30 AM–1:00 PM',
    );
    expect(timeRangeLabel('2026-10-29T23:00:00-07:00', '2026-10-30T01:00:00-07:00', AZ)).toBe(
      '11:00 PM–1:00 AM (next day)',
    );
    // Stored with another offset, shown in the phone's zone.
    expect(timeLabel('2026-10-30T16:12:04+00:00', AZ)).toBe('9:12 AM');
  });

  it('durations and the running clock', () => {
    expect(durationLabel(5106)).toBe('1 h 25 min');
    expect(durationLabel(1500)).toBe('25 min');
    expect(durationLabel(7200)).toBe('2 h');
    expect(durationLabel(59)).toBe('0 min');
    expect(clockLabel(5047)).toBe('1:24:07');
    expect(clockLabel(0)).toBe('0:00:00');
    expect(clockLabel(36_000)).toBe('10:00:00');
  });

  it('local date and time for form fields', () => {
    expect(localDateTime('2026-10-30T09:12:04-07:00', AZ)).toEqual({
      date: '2026-10-30',
      time: '09:12',
    });
    expect(localDateTime('2026-10-31T06:59:00+00:00', AZ)).toEqual({
      date: '2026-10-30',
      time: '23:59',
    });
  });

  it('plurals', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(8, 'entry', 'entries')).toBe('8 entries');
  });
});

describe('version label (decision 0016)', () => {
  it('shows the release and the commit', () => {
    expect(versionLabel('0.9.0+a1b2c3d')).toBe('0.9.0 (a1b2c3d)');
  });

  it('shows a dev build as is', () => {
    expect(versionLabel('dev')).toBe('dev');
  });
});
