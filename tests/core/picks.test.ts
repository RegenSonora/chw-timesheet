import { describe, expect, it } from 'vitest';
import {
  carryPicks,
  defaultBudgetLine,
  RECENT_TASKS_SHOWN,
  taskChoices,
} from '../../src/core/picks';
import { regen, tisupp } from './fixtures/wireframe-sample';

describe('taskChoices (SPEC §5 "recent tasks first")', () => {
  it('lists recent tasks first, then every task in source order', () => {
    const { recent, all } = taskChoices(tisupp, ['client-check-in', 'client-follow-up']);
    expect(recent.map((t) => t.id)).toEqual(['client-check-in', 'client-follow-up']);
    expect(all).toEqual(tisupp.tasks);
    expect(all).toHaveLength(21);
  });

  it(`shows at most ${String(RECENT_TASKS_SHOWN)} recent tasks`, () => {
    const ids = tisupp.tasks.slice(0, 6).map((t) => t.id);
    expect(taskChoices(tisupp, ids).recent.map((t) => t.id)).toEqual(
      ids.slice(0, RECENT_TASKS_SHOWN),
    );
  });

  it('drops ids the source does not have and repeats', () => {
    const { recent } = taskChoices(tisupp, ['domestic-support', 'outreach', 'outreach', 'gone']);
    expect(recent.map((t) => t.id)).toEqual(['outreach']);
  });

  it('has no recent group the first time', () => {
    expect(taskChoices(regen, []).recent).toEqual([]);
    expect(taskChoices(regen, []).all).toHaveLength(22);
  });
});

describe('defaultBudgetLine (SPEC §5 "defaults to the last one used")', () => {
  it('is the last one used when the source has it', () => {
    expect(defaultBudgetLine(tisupp, 'chw-referrals')).toBe('chw-referrals');
  });

  it('is none the first time or for a line the source lacks', () => {
    expect(defaultBudgetLine(tisupp, null)).toBeNull();
    expect(defaultBudgetLine(tisupp, 'domestic-support')).toBeNull();
    expect(defaultBudgetLine(regen, 'domestic-support')).toBe('domestic-support');
  });
});

describe('carryPicks (decision 0008)', () => {
  it('keeps task and budget line the new source has', () => {
    expect(carryPicks(regen, 'outreach', 'chw-referrals')).toEqual({
      task_id: 'outreach',
      budget_line_id: 'chw-referrals',
    });
  });

  it('clears picks the new source lacks', () => {
    expect(carryPicks(tisupp, 'domestic-support', 'domestic-support')).toEqual({
      task_id: null,
      budget_line_id: null,
    });
    expect(carryPicks(tisupp, 'outreach', 'domestic-support')).toEqual({
      task_id: 'outreach',
      budget_line_id: null,
    });
    expect(carryPicks(tisupp, null, null)).toEqual({ task_id: null, budget_line_id: null });
  });
});
