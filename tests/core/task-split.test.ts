// Several tasks per entry, hours split in quarter hours (decision 0024).
import { describe, expect, it } from 'vitest';
import {
  checkTask,
  finalShares,
  sharesMatch,
  splitStatus,
  uncheckTask,
} from '../../src/core/task-split';

describe('splitStatus', () => {
  it('is ok when the shares add up to the billed hours', () => {
    expect(
      splitStatus(6, [
        { task_id: 'a', quarters: 4 },
        { task_id: 'b', quarters: 2 },
      ]),
    ).toEqual({ state: 'ok', total: 6, assigned: 6 });
  });

  it('says how much is left', () => {
    expect(
      splitStatus(6, [
        { task_id: 'a', quarters: 4 },
        { task_id: 'b', quarters: 0 },
      ]),
    ).toEqual({ state: 'left', total: 6, assigned: 4, quarters: 2 });
  });

  it('says how much is too many', () => {
    expect(
      splitStatus(6, [
        { task_id: 'a', quarters: 5 },
        { task_id: 'b', quarters: 2 },
      ]),
    ).toEqual({ state: 'over', total: 6, assigned: 7, quarters: 1 });
  });

  it('with nothing checked, everything is left', () => {
    expect(splitStatus(3, [])).toEqual({ state: 'left', total: 3, assigned: 0, quarters: 3 });
  });
});

describe('checkTask', () => {
  it('the first task checked gets all the hours', () => {
    expect(checkTask([], 'a', 6)).toEqual([{ task_id: 'a', quarters: 6 }]);
  });

  it('a second task starts at 0 and the first is reset to all the hours', () => {
    // The first share may be stale after the times changed.
    expect(checkTask([{ task_id: 'a', quarters: 2 }], 'b', 6)).toEqual([
      { task_id: 'a', quarters: 6 },
      { task_id: 'b', quarters: 0 },
    ]);
  });

  it('later tasks start at 0 and keep the split so far', () => {
    expect(
      checkTask(
        [
          { task_id: 'a', quarters: 4 },
          { task_id: 'b', quarters: 2 },
        ],
        'c',
        6,
      ),
    ).toEqual([
      { task_id: 'a', quarters: 4 },
      { task_id: 'b', quarters: 2 },
      { task_id: 'c', quarters: 0 },
    ]);
  });

  it('checking a task twice changes nothing', () => {
    const shares = [{ task_id: 'a', quarters: 6 }];
    expect(checkTask(shares, 'a', 6)).toBe(shares);
  });
});

describe('uncheckTask', () => {
  it('drops the task and keeps the rest as they were', () => {
    expect(
      uncheckTask(
        [
          { task_id: 'a', quarters: 4 },
          { task_id: 'b', quarters: 2 },
        ],
        'a',
      ),
    ).toEqual([{ task_id: 'b', quarters: 2 }]);
  });
});

describe('finalShares', () => {
  it('one task gets all the billed hours, whatever it held', () => {
    expect(finalShares([{ task_id: 'a', quarters: 0 }], 5)).toEqual([
      { task_id: 'a', quarters: 5 },
    ]);
  });

  it('drops tasks left at 0 h', () => {
    expect(
      finalShares(
        [
          { task_id: 'a', quarters: 6 },
          { task_id: 'b', quarters: 0 },
        ],
        6,
      ),
    ).toEqual([{ task_id: 'a', quarters: 6 }]);
  });

  it('keeps a split as it is, even one that does not add up', () => {
    const split = [
      { task_id: 'a', quarters: 3 },
      { task_id: 'b', quarters: 2 },
    ];
    expect(finalShares(split, 6)).toEqual(split);
  });

  it('with nothing checked there are no shares', () => {
    expect(finalShares([], 6)).toEqual([]);
  });
});

describe('sharesMatch', () => {
  const tasks = new Set(['a', 'b']);

  it('accepts shares that add up, are positive whole quarters and name known tasks once', () => {
    expect(
      sharesMatch(
        [
          { task_id: 'a', quarters: 4 },
          { task_id: 'b', quarters: 2 },
        ],
        6,
        tasks,
      ),
    ).toBe(true);
  });

  it('refuses no shares, a wrong total, a zero or fractional share, a repeat or an unknown task', () => {
    expect(sharesMatch([], 6, tasks)).toBe(false);
    expect(sharesMatch([{ task_id: 'a', quarters: 5 }], 6, tasks)).toBe(false);
    expect(
      sharesMatch(
        [
          { task_id: 'a', quarters: 6 },
          { task_id: 'b', quarters: 0 },
        ],
        6,
        tasks,
      ),
    ).toBe(false);
    expect(
      sharesMatch(
        [
          { task_id: 'a', quarters: 5.5 },
          { task_id: 'b', quarters: 0.5 },
        ],
        6,
        tasks,
      ),
    ).toBe(false);
    expect(
      sharesMatch(
        [
          { task_id: 'a', quarters: 3 },
          { task_id: 'a', quarters: 3 },
        ],
        6,
        tasks,
      ),
    ).toBe(false);
    expect(sharesMatch([{ task_id: 'zzz', quarters: 6 }], 6, tasks)).toBe(false);
  });
});
